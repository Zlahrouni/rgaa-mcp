// Usage: npx tsx test-behavioral.ts https://example.com
import { chromium } from "playwright";
import {
  checkHorizontalScroll,
  checkTextSpacing,
  checkMetaRefresh,
} from "./src/behavioral.js";

const url = process.argv[2] ?? "https://example.com";

console.log(`\n🔍 Running behavioral checks on ${url}...\n`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  console.log(`✅ Page loaded: ${await page.title()}\n`);

  console.log("--- Check 1: Horizontal scroll (10.11) ---");
  const scrollResult = await checkHorizontalScroll(page);
  const icon1 = scrollResult.passed ? "✅" : "❌";
  console.log(`${icon1} ${scrollResult.detail}`);
  if (scrollResult.howToFix) console.log(`   💡 ${scrollResult.howToFix}`);

  console.log("\n--- Check 2: Text spacing (10.12) ---");
  const spacingResult = await checkTextSpacing(page);
  const icon2 = spacingResult.passed ? "✅" : "❌";
  console.log(`${icon2} ${spacingResult.detail}`);
  if (spacingResult.howToFix) console.log(`   💡 ${spacingResult.howToFix}`);

  console.log("\n--- Check 3: Meta refresh (13.1) ---");
  const metaResult = await checkMetaRefresh(page);
  const icon3 = metaResult.passed ? "✅" : "❌";
  console.log(`${icon3} ${metaResult.detail}`);
  if (metaResult.howToFix) console.log(`   💡 ${metaResult.howToFix}`);

  console.log("\n=== FULL JSON ===");
  console.log(JSON.stringify([scrollResult, spacingResult, metaResult], null, 2));
} finally {
  await browser.close();
  console.log("\n✅ Browser closed cleanly");
}
