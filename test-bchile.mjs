import { getBank } from "open-banking-chile"; // or your import path

const result = await getBank("bchile").scrape({
  rut: process.env.BANCOCHILE_RUT,
  password: process.env.BANCOCHILE_PASSWORD,
  onDebug: (line) => console.log("[bchile]", line), // live breadcrumbs
  saveScreenshots: true,                            // dumps to ./screenshots/
  headful: true,                                    // watch the real browser
});

console.log("SUCCESS:", result.success);
console.log("ACCOUNTS:", JSON.stringify(result.accounts, null, 2));
console.log("---- DEBUG LOG ----");
console.log(result.debug);   // full step-by-step log, always present
