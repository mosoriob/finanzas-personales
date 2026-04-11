#!/usr/bin/env node
// Standalone script that runs outside Next.js bundler
// Called by the API route via child_process.execFile
// Receives: bankId, rut, password as argv
// Outputs: JSON result to stdout

import { getBank } from "open-banking-chile";

const [,, bankId, rut, password] = process.argv;

if (!bankId || !rut || !password) {
  console.error(JSON.stringify({ success: false, error: "Missing arguments" }));
  process.exit(1);
}

try {
  const bank = getBank(bankId);
  if (!bank) {
    console.log(JSON.stringify({ success: false, error: `Banco "${bankId}" no soportado` }));
    process.exit(0);
  }

  const result = await bank.scrape({ rut, password });
  // Output only the data we need (strip debug/internal fields)
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
