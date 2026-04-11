#!/usr/bin/env node
// Standalone script that runs outside Next.js bundler
// Called by the API route via child_process.spawn
// Receives: bankId as argv[2], credentials via stdin as JSON
// Outputs: JSON result to stdout

import { getBank } from "open-banking-chile";

const bankId = process.argv[2];

if (!bankId) {
  console.log(JSON.stringify({ success: false, error: "Missing bankId argument" }));
  process.exit(1);
}

// Read credentials from stdin (safer than argv — not visible in ps)
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { rut, password } = JSON.parse(Buffer.concat(chunks).toString());

if (!rut || !password) {
  console.log(JSON.stringify({ success: false, error: "Missing credentials on stdin" }));
  process.exit(1);
}

try {
  const bank = getBank(bankId);
  if (!bank) {
    console.log(JSON.stringify({ success: false, error: `Banco "${bankId}" no soportado` }));
    process.exit(0);
  }

  const result = await bank.scrape({ rut, password });
  const output = {
    success: result.success,
    bank: result.bank,
    error: result.error,
    accounts: (result.accounts ?? []).map(a => ({
      label: a.label,
      balance: a.balance,
      movements: a.movements ?? [],
    })),
    creditCards: (result.creditCards ?? []).map(c => ({
      label: c.label,
      national: c.national,
      movements: c.movements ?? [],
    })),
  };
  console.log(JSON.stringify(output));
} catch (err) {
  console.log(JSON.stringify({ success: false, error: err.message }));
}
