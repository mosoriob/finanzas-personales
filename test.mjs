import { getBank } from "open-banking-chile"; // or your import path

const result = await getBank("bci").scrape({
  rut: process.env.BCI_RUT,
  password: process.env.BCI_PASSWORD,
  onDebug: (line) => console.log("[bci]", line), // live breadcrumbs
  saveScreenshots: true,                         // dumps to ./screenshots/
  headful: true,                                 // watch the real browser
});

console.log("SUCCESS:", result.success);
console.log("ACCOUNTS:", JSON.stringify(result.accounts, null, 2));
console.log("---- DEBUG LOG ----");
console.log(result.debug);   // full step-by-step log, always present

