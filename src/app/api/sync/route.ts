import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { matchCategory } from "@/lib/rules";
import { toStoredCurrency } from "@/lib/currency";
import { spawn } from "child_process";

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
        const [day, month, year] = m.date.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        // Currency is part of the identity: a USD charge and a coincidentally
        // same-amount peso charge are distinct rows. Absent = null (CLP).
        const currency = toStoredCurrency(m.currency);
        const existing = await prisma.transaction.findFirst({
          where: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, currency },
        });

        if (existing) { skippedCount++; continue; }

        const matched = matchCategory(m.description, rules);
        const categoryId = matched ?? catMap["Otro"];

        await prisma.transaction.create({
          data: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, categoryId, currency },
        });
        importedCount++;
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
        const [day, month, year] = m.date.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        const currency = toStoredCurrency(m.currency);
        const existing = await prisma.transaction.findFirst({
          where: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, currency },
        });

        if (existing) { skippedCount++; continue; }

        const matched = matchCategory(m.description, rules);
        const categoryId = matched ?? catMap["Otro"];

        await prisma.transaction.create({
          data: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, categoryId, currency },
        });
        importedCount++;
      }
    }

    return NextResponse.json({ success: true, imported: importedCount, skipped: skippedCount, bank: result.bank });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Sync error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
