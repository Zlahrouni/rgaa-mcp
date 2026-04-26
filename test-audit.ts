// Usage: npx tsx test-audit.ts https://example.com
// Usage: npx tsx test-audit.ts https://example.com mobile

import { runAudit } from "./src/audit.js";

const url = process.argv[2];
const viewport = (process.argv[3] as "desktop" | "mobile") ?? "desktop";

if (!url) {
  console.error("Usage: npx tsx test-audit.ts <url> [desktop|mobile]");
  process.exit(1);
}

console.log(`\n🔍 Auditing ${url} (${viewport})...\n`);

const result = await runAudit(url, viewport);

console.log("=== PAGE INFO ===");
console.log(`Title: ${result.pageTitle}`);
console.log(`URL: ${result.pageUrl}`);
console.log(`Timestamp: ${result.timestamp}`);

console.log("\n=== AXE RESULTS ===");
console.log(`Violations: ${result.axe.violations.length}`);
console.log(`Passes: ${result.axe.passes}`);
console.log(`Incomplete: ${result.axe.incomplete}`);

console.log("\n=== VIOLATIONS (first 3) ===");
result.axe.violations.slice(0, 3).forEach((v) => {
  console.log(`\n[${v.impact.toUpperCase()}] ${v.id}`);
  console.log(`  ${v.help}`);
  console.log(`  Nodes affected: ${v.nodes.length}`);
  console.log(`  First node: ${v.nodes[0]?.html?.slice(0, 100)}`);
});

console.log("\n=== BEHAVIORAL CHECKS ===");
result.behavioral.forEach((b) => {
  const icon = b.passed ? "✅" : "❌";
  console.log(`${icon} Criterion ${b.criterion}: ${b.detail}`);
});

console.log("\n=== FULL JSON (copy for debugging) ===");
console.log(JSON.stringify(result, null, 2));
