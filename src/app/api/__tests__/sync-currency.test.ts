/**
 * Tests that the sync/import route threads the scraper's per-movement
 * `currency` marker through to persistence: a USD movement is stored with
 * currency:"USD", and the de-duplication lookup is keyed on currency too (so a
 * USD charge and a same-amount peso charge are distinct, and re-importing the
 * same USD charge still de-dupes).
 *
 * The scraper is an external child process; we mock child_process.spawn to feed
 * a synthetic ScrapeResult, and mock prisma via the established vi.mock pattern.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// Synthetic scraper output injected per-test.
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
    // Once credentials are written, emit the JSON line and close.
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
    transaction: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { POST } from "@/app/api/sync/route";
import { prisma } from "@/lib/db";

const mockCategoryFindMany = prisma.category.findMany as ReturnType<typeof vi.fn>;
const mockRuleFindMany = prisma.rule.findMany as ReturnType<typeof vi.fn>;
const mockAccountFindFirst = prisma.account.findFirst as ReturnType<typeof vi.fn>;
const mockTxFindFirst = prisma.transaction.findFirst as ReturnType<typeof vi.fn>;
const mockTxCreate = prisma.transaction.create as ReturnType<typeof vi.fn>;

function makeRequest() {
  return {
    json: async () => ({ bankId: "bci", rut: "1-9", password: "x" }),
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SYNC_SCRIPT_PATH = "/fake/scraper.js";
  mockCategoryFindMany.mockResolvedValue([{ id: 1, name: "Otro", emoji: "📌" }]);
  mockRuleFindMany.mockResolvedValue([]);
  // Reuse one existing credit-card account so no account create is needed.
  mockAccountFindFirst.mockResolvedValue({ id: 10, name: "Tarjeta", bank: "BCI", balance: 0 });
});

describe("sync route — currency threading", () => {
  it("persists a USD credit-card movement with currency:\"USD\"", async () => {
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [
            { date: "15-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "USD" },
          ],
        },
      ],
    };
    mockTxFindFirst.mockResolvedValue(null);
    mockTxCreate.mockResolvedValue({ id: 1 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(mockTxCreate).toHaveBeenCalledTimes(1);
    expect(mockTxCreate.mock.calls[0][0].data).toMatchObject({
      amount: -119,
      currency: "USD",
      description: "ANTHROPIC CLAUDE",
    });
  });

  it("includes currency in the de-duplication lookup key", async () => {
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [
            { date: "15-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "USD" },
          ],
        },
      ],
    };
    mockTxFindFirst.mockResolvedValue(null);
    mockTxCreate.mockResolvedValue({ id: 1 });

    await POST(makeRequest());

    expect(mockTxFindFirst).toHaveBeenCalledTimes(1);
    expect(mockTxFindFirst.mock.calls[0][0].where).toMatchObject({ currency: "USD" });
  });

  it("re-importing the same USD charge does not create a duplicate", async () => {
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [
            { date: "15-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "USD" },
          ],
        },
      ],
    };
    // The currency-augmented de-dup lookup already finds the prior USD row.
    mockTxFindFirst.mockResolvedValue({ id: 99, currency: "USD" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
    expect(body.imported).toBe(0);
  });

  it("treats a USD charge and a same-amount CLP charge as distinct", async () => {
    scrapeResult = {
      success: true,
      bank: "BCI",
      creditCards: [
        {
          label: "Tarjeta",
          movements: [
            { date: "15-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "USD" },
            { date: "15-06-2026", description: "ANTHROPIC CLAUDE", amount: -119, currency: "CLP" },
          ],
        },
      ],
    };
    // Fake store keyed on the full where clause (currency included): only an
    // exact currency match de-dupes, so the two same-amount rows are distinct.
    const store: Array<{ amount: number; currency: "USD" | null }> = [];
    mockTxFindFirst.mockImplementation(async ({ where }) =>
      store.find((r) => r.amount === where.amount && r.currency === where.currency) ?? null
    );
    mockTxCreate.mockImplementation(async ({ data }) => {
      store.push({ amount: data.amount, currency: data.currency });
      return { id: store.length };
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(0);
    expect(mockTxCreate.mock.calls.map((c) => c[0].data.currency)).toEqual(["USD", null]);
  });

  it("persists a peso movement with currency null (absent marker)", async () => {
    scrapeResult = {
      success: true,
      bank: "BCI",
      accounts: [
        {
          label: "Cuenta",
          balance: 0,
          movements: [{ date: "15-06-2026", description: "PAGO", amount: -5000 }],
        },
      ],
    };
    mockTxFindFirst.mockResolvedValue(null);
    mockTxCreate.mockResolvedValue({ id: 1 });

    await POST(makeRequest());

    expect(mockTxCreate.mock.calls[0][0].data.currency).toBeNull();
    expect(mockTxFindFirst.mock.calls[0][0].where).toMatchObject({ currency: null });
  });
});
