/**
 * Tests the sync/import route's date-drift duplicate-suspect ladder through the
 * exported POST handler (the same seam as sync-currency.test.ts): child_process
 * is mocked to feed a synthetic ScrapeResult, and @/lib/db is mocked with a small
 * in-memory transaction store so the fuzzy-candidate lookup, the pre-sync id
 * snapshot, and currency-as-identity are exercised as real query behaviour rather
 * than pre-baked return values.
 *
 * Covered: a drifted-date movement is staged (not imported); two same-amount
 * consecutive-day movements arriving in one fresh sync are BOTH imported (the
 * pre-sync snapshot rule); re-syncing an already-staged movement does not queue a
 * second pending; a USD movement is never matched against a same-amount CLP
 * candidate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

let scrapeResult: unknown;

function fakeSpawn() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: () => void; end: () => void };
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    write: () => {},
    end: () => {
      setImmediate(() => {
        child.stdout.emit("data", Buffer.from(JSON.stringify(scrapeResult)));
        child.emit("close", 0);
      });
    },
  };
  return child;
}

vi.mock("child_process", () => ({
  spawn: fakeSpawn,
  default: { spawn: fakeSpawn },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    category: { findMany: vi.fn(), create: vi.fn() },
    rule: { findMany: vi.fn() },
    account: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    transaction: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    pendingSyncTransaction: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { POST } from "@/app/api/sync/route";
import { prisma } from "@/lib/db";

const mockCategoryFindMany = prisma.category.findMany as ReturnType<typeof vi.fn>;
const mockRuleFindMany = prisma.rule.findMany as ReturnType<typeof vi.fn>;
const mockAccountFindFirst = prisma.account.findFirst as ReturnType<typeof vi.fn>;
const mockTxFindFirst = prisma.transaction.findFirst as ReturnType<typeof vi.fn>;
const mockTxFindMany = prisma.transaction.findMany as ReturnType<typeof vi.fn>;
const mockTxCreate = prisma.transaction.create as ReturnType<typeof vi.fn>;
const mockTxAggregate = prisma.transaction.aggregate as ReturnType<typeof vi.fn>;
const mockPendingFindFirst = prisma.pendingSyncTransaction.findFirst as ReturnType<typeof vi.fn>;
const mockPendingCreate = prisma.pendingSyncTransaction.create as ReturnType<typeof vi.fn>;

function makeRequest() {
  return {
    json: async () => ({ bankId: "bci", rut: "1-9", password: "x" }),
  } as unknown as Parameters<typeof POST>[0];
}

type Row = { id: number; date: Date; amount: number; accountId: number; currency: string | null };

// Seeds the transaction mocks with an in-memory store. `seed` are the rows that
// exist BEFORE this sync (their ids are the pre-sync snapshot); the aggregate
// max is taken from them. findFirst/findMany honour the where clause the route
// builds so the id-snapshot guard and currency filter are really tested.
function installStore(seed: Row[]) {
  const store: Row[] = [...seed];
  let nextId = (seed.reduce((m, r) => Math.max(m, r.id), 0)) + 1;

  mockTxAggregate.mockResolvedValue({
    _max: { id: store.reduce((m, r) => Math.max(m, r.id), 0) },
  });

  mockTxFindFirst.mockImplementation(async ({ where }) =>
    store.find(
      (r) =>
        r.date.getTime() === (where.date as Date).getTime() &&
        r.amount === where.amount &&
        r.accountId === where.accountId &&
        r.currency === where.currency
    ) ?? null
  );

  mockTxFindMany.mockImplementation(async ({ where }) => {
    const lo = (where.date.gte as Date).getTime();
    const hi = (where.date.lte as Date).getTime();
    const maxId = where.id.lte as number;
    return store.filter(
      (r) =>
        r.accountId === where.accountId &&
        r.amount === where.amount &&
        r.currency === where.currency &&
        r.id <= maxId &&
        r.date.getTime() >= lo &&
        r.date.getTime() <= hi
    );
  });

  mockTxCreate.mockImplementation(async ({ data }) => {
    const row = { id: nextId++, ...data };
    store.push(row);
    return row;
  });

  return store;
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SYNC_SCRIPT_PATH = "/fake/scraper.js";
  mockCategoryFindMany.mockResolvedValue([{ id: 1, name: "Otro", emoji: "📌" }]);
  mockRuleFindMany.mockResolvedValue([]);
  mockAccountFindFirst.mockResolvedValue({ id: 10, name: "Tarjeta", bank: "BCI", balance: 0 });
  mockPendingFindFirst.mockResolvedValue(null);
  mockPendingCreate.mockResolvedValue({ id: 1 });
});

describe("sync route — duplicate-suspect staging", () => {
  it("stages a drifted-date movement as a suspect instead of importing it", async () => {
    // A pre-sync CLP charge of -4770 dated the 20th; the re-scrape reports the
    // settled charge two days later (the 22nd) with no exact match.
    installStore([{ id: 281, date: utc(2026, 6, 20), amount: -4770, accountId: 10, currency: null }]);
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [{ date: "22-06-2026", description: "San pancracio compras", amount: -4770 }],
        },
      ],
    };

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.pendingReview).toBe(1);
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockPendingCreate).toHaveBeenCalledTimes(1);
    expect(mockPendingCreate.mock.calls[0][0].data).toMatchObject({
      amount: -4770,
      accountId: 10,
      candidateId: 281,
      currency: null,
    });
  });

  it("imports both of two same-amount consecutive-day movements in one fresh sync", async () => {
    // Fresh DB (no pre-sync rows). Two genuinely distinct same-fare charges on
    // the 15th and 16th must both import — the pre-sync snapshot (max id 0) keeps
    // the first, created during THIS sync, from being flagged against the second.
    installStore([]);
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [
            { date: "15-06-2026", description: "UBER TRIP", amount: -3000 },
            { date: "16-06-2026", description: "UBER TRIP", amount: -3000 },
          ],
        },
      ],
    };

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.imported).toBe(2);
    expect(body.pendingReview).toBe(0);
    expect(mockPendingCreate).not.toHaveBeenCalled();
    expect(mockTxCreate).toHaveBeenCalledTimes(2);
  });

  it("does not queue a second pending when the movement is already staged", async () => {
    installStore([{ id: 281, date: utc(2026, 6, 20), amount: -4770, accountId: 10, currency: null }]);
    // A suspect for this exact movement is already staged from an earlier sync.
    mockPendingFindFirst.mockResolvedValue({ id: 7, amount: -4770, accountId: 10, candidateId: 281 });
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [{ date: "22-06-2026", description: "San pancracio compras", amount: -4770 }],
        },
      ],
    };

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.pendingReview).toBe(1);
    expect(mockPendingCreate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
  });

  it("never matches a USD movement against a same-amount CLP candidate", async () => {
    // Pre-sync CLP charge of -119 dated the 20th. A USD -119 charge dated the
    // 22nd shares amount/account/date-window but NOT currency, so it must import
    // rather than be flagged as a duplicate of the peso row.
    installStore([{ id: 281, date: utc(2026, 6, 20), amount: -119, accountId: 10, currency: null }]);
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [{ date: "22-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "USD" }],
        },
      ],
    };

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.imported).toBe(1);
    expect(body.pendingReview).toBe(0);
    expect(mockPendingCreate).not.toHaveBeenCalled();
    expect(mockTxCreate.mock.calls[0][0].data).toMatchObject({ amount: -119, currency: "USD" });
  });
});
