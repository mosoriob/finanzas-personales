import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { spawn } from "child_process";

// Category keyword mapping for auto-categorization
const CATEGORY_RULES: [RegExp, string][] = [
  [/supermercado|lider|jumbo|santa isabel|unimarc|tottus/i, "Supermercado"],
  [/uber|copec|shell|petrobras|bip|metro|transporte|taxi|cabify|didi/i, "Transporte"],
  [/netflix|spotify|steam|playstation|xbox|disney|hbo|amazon prime|entretenimiento/i, "Entretenimiento"],
  [/farmacia|ahumada|cruz verde|salcobrand|hospital|clinica|doctor|medic|gimnasio/i, "Salud"],
  [/rappi|ifood|uber eats|pedidos ya|restaurant|sushi|pizza|burger|mcdon|domino|papa john/i, "Restaurant"],
  [/entel|movistar|claro|wom|vtr|gtd|enel|aguas andinas|chilquinta|cge|gas|internet|telefon/i, "Servicios"],
  [/sodimac|easy|homecenter|mercado libre|falabella|ripley|paris|ikea/i, "Hogar"],
  [/universidad|colegio|escuela|libro|curso|udemy|coursera|educacion/i, "Educación"],
  [/sueldo|salario|remuneracion|honorario|ingreso/i, "Sueldo"],
  [/transferencia|tef|traspaso/i, "Transferencia"],
];

function guessCategory(description: string): string {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(description)) return category;
  }
  return "Otro";
}

type ScrapeResult = { success: boolean; error?: string; bank?: string; accounts?: Array<{ label?: string; balance?: number; movements: Array<{ date: string; description: string; amount: number }> }>; creditCards?: Array<{ label?: string; national?: { used?: number }; movements: Array<{ date: string; description: string; amount: number }> }> };

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
      const accountName = acc.label || "CuentaRUT";

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

        const existing = await prisma.transaction.findFirst({
          where: { date, description: m.description, amount: m.amount, accountId: dbAccount.id },
        });

        if (existing) { skippedCount++; continue; }

        const categoryName = guessCategory(m.description);
        const categoryId = catMap[categoryName] ?? catMap["Otro"];

        await prisma.transaction.create({
          data: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, categoryId },
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

        const existing = await prisma.transaction.findFirst({
          where: { date, description: m.description, amount: m.amount, accountId: dbAccount.id },
        });

        if (existing) { skippedCount++; continue; }

        const categoryName = guessCategory(m.description);
        const categoryId = catMap[categoryName] ?? catMap["Otro"];

        await prisma.transaction.create({
          data: { date, description: m.description, amount: m.amount, accountId: dbAccount.id, categoryId },
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
