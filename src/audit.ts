import { chromium } from "playwright";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  checkHorizontalScroll,
  checkTextSpacing,
  checkMetaRefresh,
  type BehavioralResult,
} from "./behavioral.js";

const _require = createRequire(import.meta.url);
const axeSource = readFileSync(_require.resolve("axe-core/axe.min.js"), "utf-8");

export interface AxeNode {
  html: string;
  target: string[];
  failureSummary: string;
}

export interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
}

export interface AuditRawResult {
  url: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
  viewport: "desktop" | "mobile";
  axe: {
    violations: AxeViolation[];
    passes: number;
    incomplete: number;
    inapplicable: number;
  };
  behavioral: BehavioralResult[];
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 667 },
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function runAudit(
  url: string,
  viewport: "desktop" | "mobile"
): Promise<AuditRawResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORTS[viewport],
      userAgent: USER_AGENT,
    });
    const page = await context.newPage();

    // Step 2 — Load the page
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    } catch (err) {
      const error = err as Error;
      throw new Error(`Impossible d'accéder à ${url} : ${error.message}`);
    }

    // Step 3 — Inject and run axe-core (from node_modules, avoids CSP issues with CDN)
    await page.addScriptTag({ content: axeSource });

    await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)["axe"] !== "undefined", {
      timeout: 10_000,
    });

    type AxeRunResult = {
      violations: Array<{
        id: string;
        impact: string;
        description: string;
        help: string;
        helpUrl: string;
        nodes: Array<{
          html: string;
          target: string[];
          failureSummary: string;
        }>;
      }>;
      passes: unknown[];
      incomplete: unknown[];
      inapplicable: unknown[];
    };

    const axeRaw = await page.evaluate(async () => {
      const axe = (window as unknown as Record<string, unknown>)["axe"] as {
        run: (opts: { runOnly: { type: string; values: string[] } }) => Promise<AxeRunResult>;
      };
      return axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      });
    }, { timeout: 60_000 });

    const violations: AxeViolation[] = axeRaw.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        html: n.html.slice(0, 200),
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    }));

    // Step 4 — Behavioral checks
    const behavioralSettled = await Promise.allSettled([
      checkHorizontalScroll(page),
      checkTextSpacing(page),
      checkMetaRefresh(page),
    ]);

    const criterionIds = ["10.11", "10.12", "13.1"];
    const behavioral: BehavioralResult[] = behavioralSettled.map((result, i) => {
      if (result.status === "fulfilled") return result.value;
      return {
        criterion: criterionIds[i],
        criterionTitle: "Vérification comportementale",
        passed: false,
        detail: `Erreur inattendue : ${(result.reason as Error)?.message ?? "inconnue"}`,
        wcagReference: "",
      };
    });

    // Step 5 — Extract page metadata
    const [pageTitle, pageUrl] = await Promise.all([
      page.evaluate(() => document.title),
      page.evaluate(() => window.location.href),
    ]);

    return {
      url,
      pageUrl,
      pageTitle,
      timestamp: new Date().toISOString(),
      viewport,
      axe: {
        violations,
        passes: axeRaw.passes.length,
        incomplete: axeRaw.incomplete.length,
        inapplicable: axeRaw.inapplicable.length,
      },
      behavioral,
    };
  } finally {
    await browser.close();
  }
}
