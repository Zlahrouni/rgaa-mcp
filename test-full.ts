// Usage: npx tsx test-full.ts https://example.com
// Tests the complete pipeline: audit → enrich → report

import { runAudit } from "./src/audit.js";
import { enrichWithRGAA } from "./src/mapper.js";
import { formatReport } from "./src/report.js";
import { getCriterion } from "./src/criteria.js";

const url = process.argv[2] ?? "https://example.com";
const viewport = (process.argv[3] as "desktop" | "mobile") ?? "desktop";

console.log(`\n🚀 Full pipeline test: ${url} (${viewport})\n`);
console.log("Step 1/3 — Running audit (Playwright + axe-core)...");

const raw = await runAudit(url, viewport);
console.log(`✅ Audit complete: ${raw.axe.violations.length} violations found`);

console.log("Step 2/3 — Enriching with RGAA mapping...");
const enriched = await enrichWithRGAA(raw);
console.log(`✅ Mapped: ${enriched.summary.affectedRGAACriteria.length} RGAA criteria affected`);

console.log("Step 3/3 — Generating report...");
const report = await formatReport(enriched);
console.log(`✅ Report generated: ${report.length} characters\n`);

console.log("=".repeat(60));
console.log("FINAL REPORT");
console.log("=".repeat(60));
console.log(report);

console.log("\n" + "=".repeat(60));
console.log("CRITERION LOOKUP TEST — Critère 1.1");
console.log("=".repeat(60));
const c = await getCriterion("1.1");
if (c) {
  console.log(`Title: ${c.title}`);
  console.log(`Tests: ${c.tests.length}`);
  console.log(`Methodology: ${c.methodology ? "✅ present" : "❌ missing"}`);
} else {
  console.log("❌ Criterion 1.1 not found");
}
