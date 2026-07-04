import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { matchCategory } from "@/lib/rules";
import { toStoredCurrency } from "@/lib/currency";
import { spawn } from "child_process";

// ±3 days, inclusive: the observed pending→settled date drift. Dates are stored
// at UTC midnight, so this is a 3-day range on either side of the candidate date.
const DRIFT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type Rule = { id: number; match: string; categoryId: number };

// The per-movement decision, applied identically in the accounts loop and the
// credit-cards loop (unified here so the ladder lives in one place):
//   1. Exact match on (date, amount, accountId, currency) → skip.
//   2. Rejection memory: a RejectedDuplicate with the same (accountId, amount,
//      currency) and a remembered date within ±3 days of the movement → silently
//      skip (the user already confirmed this drifted charge is a duplicate). This
//      MUST run before the fuzzy step, or a rejected duplicate re-queues forever.
//   3. Fuzzy candidate: an existing transaction that existed BEFORE this sync
//      (id ≤ maxTxId), matches (amount, accountId, currency), and whose date is
//      within ±3 days of the movement (but not an exact date match) → the
//      movement is a suspected date-drift duplicate. Stage it (unless already
//      staged) and do NOT insert a real transaction.
//   4. Else → insert the transaction.
// Fuzzy matching (and the rejection window) use amount + account + currency only
// — never description or a merchant prefix. Currency stays part of identity
// everywhere, so a USD charge never matches a same-amount CLP row or rejection.
async function decideMovement(
  m: Movement,
  accountId: number,
  rules: Rule[],
  otroCategoryId: number,
  maxTxId: number,
): Promise<"imported" | "skipped" | "pending"> {
  const [day, month, year] = m.date.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const currency = toStoredCurrency(m.currency);

  // 1. Exact match → skip. description is deliberately NOT part of the key: the
  // bank's fixed-width description tail drifts (merchant city ↔ "compras") as a
  // charge settles, so keying on it would re-import the same charge as a dupe.
  const exact = await prisma.transaction.findFirst({
    where: { date, amount: m.amount, accountId, currency },
  });
  if (exact) return "skipped";

  const lo = new Date(date.getTime() - DRIFT_WINDOW_MS);
  const hi = new Date(date.getTime() + DRIFT_WINDOW_MS);

  // 2. Rejection memory: the user already confirmed a same-amount/account/
  // currency charge within ±3 days of this movement is a duplicate. Silently
  // skip it (counts as skipped). This runs BEFORE the fuzzy step so a rejected
  // duplicate — which the scraper keeps re-emitting every sync — is not re-queued
  // forever. A movement OUTSIDE ±3 days of every rejection is not covered and
  // falls through to the fuzzy step, so a genuinely new later charge is still
  // flagged. Currency stays part of identity: a USD charge never matches a CLP
  // rejection.
  const rejected = await prisma.rejectedDuplicate.findFirst({
    where: { accountId, amount: m.amount, currency, date: { gte: lo, lte: hi } },
  });
  if (rejected) return "skipped";

  // 3. Fuzzy candidate: same amount/account/currency, pre-sync id, date within
  // ±3 days but not exactly equal. The id ≤ maxTxId guard is load-bearing — it
  // stops two real same-amount charges that both arrive in THIS sync (e.g. two
  // same-fare rides on consecutive days) from being flagged against each other.
  const nearby = await prisma.transaction.findMany({
    where: {
      accountId,
      amount: m.amount,
      currency,
      id: { lte: maxTxId },
      date: { gte: lo, lte: hi },
    },
    select: { id: true, date: true },
  });
  // Nearest-date, lowest-id candidate for determinism (excluding an exact-date
  // hit, which would have been an exact match above).
  const candidate = nearby
    .filter((c) => c.date.getTime() !== date.getTime())
    .sort((a, b) => {
      const da = Math.abs(a.date.getTime() - date.getTime());
      const db = Math.abs(b.date.getTime() - date.getTime());
      return da !== db ? da - db : a.id - b.id;
    })[0];

  if (candidate) {
    // Already staged for this movement? Do nothing (no second pending).
    const already = await prisma.pendingSyncTransaction.findFirst({
      where: { date, amount: m.amount, accountId, currency },
    });
    if (!already) {
      const categoryId = matchCategory(m.description, rules) ?? otroCategoryId;
      await prisma.pendingSyncTransaction.create({
        data: {
          date,
          description: m.description,
          amount: m.amount,
          currency,
          accountId,
          categoryId,
          candidateId: candidate.id,
        },
      });
    }
    return "pending";
  }

  // 4. Insert as a real transaction.
  const categoryId = matchCategory(m.description, rules) ?? otroCategoryId;
  await prisma.transaction.create({
    data: { date, description: m.description, amount: m.amount, accountId, categoryId, currency },
  });
  return "imported";
}

// The scraper emits an optional per-movement `currency` ("USD" for the BCI
// "Internacional USD" tab; absent = CLP). We consume it as-is. null/absent is
// persisted as null (CLP) so existing rows stay valid without a backfill.
type Movement = { date: string; description: string; amount: number; currency?: "CLP" | "USD" };
type ScrapeResult = { success: boolean; error?: string; bank?: string; accounts?: Array<{ label?: string; balance?: number; movements: Movement[] }>; creditCards?: Array<{ label?: string; national?: { used?: number }; movements: Movement[] }> };

function runScraper(bankId: string, rut: string, password: string): Promise<ScrapeResult> {
  return new Promise((resolve, reject) => {
    // Resolved from the environment (not a build-time literal) so the
    // bundler treats the sidecar script as a runtime resource, not a
    // module to trace. Set in the Docker image and .env for local dev.
    const scriptPath = process.env.SYNC_SCRIPT_PATH;
    if (!scriptPath) {
      reject(new Error("SYNC_SCRIPT_PATH is not configured"));
      return;
    }
    // Pass only bankId as argv, credentials via stdin (not visible in ps)
    const child = spawn("node", [scriptPath, bankId], { timeout: 180000 });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    // Write credentials to stdin and close it
    child.stdin.write(JSON.stringify({ rut, password }));
    child.stdin.end();

    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }
      try {
        const lines = stdout.trim().split("\n");
        const jsonLine = lines[lines.length - 1];
        resolve(JSON.parse(jsonLine));
      } catch {
        reject(new Error("Error parsing scraper output"));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { bankId, rut, password } = await req.json();

    if (!bankId || !rut || !password) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Run scraper as external process (avoids bundler issues with puppeteer)
    const result = await runScraper(bankId, rut, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Error al conectar con el banco" }, { status: 500 });
    }

    // Load category map
    const categories = await prisma.category.findMany();
    const catMap: Record<string, number> = {};
    for (const c of categories) catMap[c.name] = c.id;

    if (!catMap["Otro"]) {
      const otro = await prisma.category.create({ data: { name: "Otro", emoji: "📌" } });
      catMap["Otro"] = otro.id;
    }

    // Load categorization rules once; matchCategory is the single matching seam.
    const rules = await prisma.rule.findMany({
      select: { id: true, match: true, categoryId: true },
    });

    let importedCount = 0;
    let skippedCount = 0;
    let pendingReviewCount = 0;

    const otroCategoryId = catMap["Otro"];

    // Snapshot the max existing transaction id BEFORE the import loop. The fuzzy
    // step only matches candidates with id ≤ this marker, so rows created during
    // this very sync can never be flagged as duplicates of each other.
    const maxTx = await prisma.transaction.aggregate({ _max: { id: true } });
    const maxTxId = maxTx._max.id ?? 0;

    const tally = (outcome: "imported" | "skipped" | "pending") => {
      if (outcome === "imported") importedCount++;
      else if (outcome === "skipped") skippedCount++;
      else pendingReviewCount++;
    };

    const BANK_NAMES: Record<string, string> = {
      bestado: "BancoEstado", bchile: "Banco de Chile", santander: "Santander",
      bci: "BCI", itau: "Itaú", falabella: "Banco Falabella",
      scotiabank: "Scotiabank", bice: "BICE", edwards: "Banco Edwards",
    };
    const bankName = BANK_NAMES[bankId] ?? bankId;

    // Process checking/savings accounts
    for (const acc of result.accounts ?? []) {
      const accountName = acc.label || "Cuenta";

      let dbAccount = await prisma.account.findFirst({
        where: { name: accountName, bank: bankName },
      });

      if (!dbAccount) {
        dbAccount = await prisma.account.create({
          data: { name: accountName, bank: bankName, type: "checking", balance: acc.balance ?? 0, color: "#38a169" },
        });
      } else {
        await prisma.account.update({
          where: { id: dbAccount.id },
          data: { balance: acc.balance ?? dbAccount.balance },
        });
      }

      for (const m of acc.movements ?? []) {
        tally(await decideMovement(m, dbAccount.id, rules, otroCategoryId, maxTxId));
      }
    }

    // Process credit cards
    for (const card of result.creditCards ?? []) {
      const cardName = card.label || "Tarjeta de Crédito";

      let dbAccount = await prisma.account.findFirst({
        where: { name: cardName, bank: bankName },
      });

      if (!dbAccount) {
        dbAccount = await prisma.account.create({
          data: { name: cardName, bank: bankName, type: "credit_card", balance: card.national ? -(card.national.used ?? 0) : 0, color: "#a78bfa" },
        });
      }

      for (const m of card.movements ?? []) {
        tally(await decideMovement(m, dbAccount.id, rules, otroCategoryId, maxTxId));
      }
    }

    return NextResponse.json({ success: true, imported: importedCount, skipped: skippedCount, pendingReview: pendingReviewCount, bank: result.bank });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Sync error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
