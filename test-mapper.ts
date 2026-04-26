// Usage: npx tsx test-mapper.ts https://example.com
// Runs the full audit then enriches with RGAA mapping

import { runAudit } from "./src/audit.js";
import { enrichWithRGAA } from "./src/mapper.js";
import { getCriterion, getThemes } from "./src/criteria.js";

const url = process.argv[2] ?? "https://example.com";

console.log(`\n🔍 Auditing and mapping ${url}...\n`);

const raw = await runAudit(url, "desktop");
const enriched = await enrichWithRGAA(raw);

console.log("=== SUMMARY ===");
console.log(`Total violations: ${enriched.summary.totalViolations}`);
console.log(`Unmapped violations: ${enriched.summary.unmappedViolations}`);
console.log(`Critical: ${enriched.summary.criticalCount}`);
console.log(`Serious: ${enriched.summary.seriousCount}`);
console.log(`Moderate: ${enriched.summary.moderateCount}`);
console.log(`Minor: ${enriched.summary.minorCount}`);
console.log(`\nAffected RGAA criteria: ${enriched.summary.affectedRGAACriteria.join(", ")}`);

console.log("\n=== VIOLATIONS WITH RGAA MAPPING ===");
for (const v of enriched.violations.slice(0, 5)) {
  console.log(`\n[${v.impact.toUpperCase()}] ${v.axeRuleId}`);
  if (v.unmapped) {
    console.log(`  ⚠️  No RGAA mapping for this rule`);
  } else {
    console.log(`  RGAA: ${v.rgaaCriteriaIds.join(", ")} (${v.rgaaTheme})`);

    const criterion = await getCriterion(v.rgaaCriteriaIds[0]);
    if (criterion) {
      console.log(`  Title: ${criterion.title}`);
      console.log(`  Level: WCAG ${criterion.level}`);
    }
  }
  console.log(`  Nodes affected: ${v.nodes.length}`);
  console.log(`  First node: ${v.nodes[0]?.html?.slice(0, 100)}`);
}


console.log("\n=== BEHAVIORAL CHECKS ===");
enriched.behavioral.forEach((b) => {
  const icon = b.passed ? "✅" : "❌";
  console.log(`${icon} [${b.criterion}] ${b.criterionTitle}`);
  console.log(`   ${b.detail}`);
  if (b.howToFix) console.log(`   💡 ${b.howToFix}`);
});

console.log("\n=== THEMES ===");
const themes = await getThemes();
themes.forEach((t) => console.log(`  ${t.id}. ${t.name} (${t.criteriaCount} critères)`));
