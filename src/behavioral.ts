import type { Page } from "playwright";

export interface BehavioralResult {
  criterion: string;
  criterionTitle: string;
  passed: boolean;
  detail: string;
  wcagReference: string;
  howToFix?: string;
}

export async function checkHorizontalScroll(page: Page): Promise<BehavioralResult> {
  const originalViewport = page.viewportSize();
  try {
    await page.setViewportSize({ width: 320, height: 667 });
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const offenders: Array<{ tag: string; className: string; width: number }> = [];
      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 5) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const tag = el.tagName.toLowerCase();
          if (["table", "pre", "code", "iframe", "canvas", "svg"].includes(tag)) continue;
          offenders.push({
            tag,
            className: el.className?.toString().slice(0, 50) ?? "",
            width: Math.round(rect.width),
          });
          if (offenders.length >= 5) break;
        }
      }
      return {
        hasScroll: document.documentElement.scrollWidth > window.innerWidth + 5,
        offenders,
      };
    });

    if (!result.hasScroll) {
      return {
        criterion: "10.11",
        criterionTitle: "Pas de défilement horizontal à 320px",
        passed: true,
        detail: "Aucun défilement horizontal détecté à 320px de large.",
        wcagReference: "1.4.10 Reflow (AA)",
      };
    }

    return {
      criterion: "10.11",
      criterionTitle: "Pas de défilement horizontal à 320px",
      passed: false,
      detail: `Défilement horizontal détecté à 320px. ${result.offenders.length} élément(s) débordent : ${result.offenders.map((o) => `<${o.tag}> (${o.width}px)`).join(", ")}`,
      wcagReference: "1.4.10 Reflow (AA)",
      howToFix:
        "Utiliser des unités relatives (%, vw, rem) plutôt que des largeurs fixes en px. Vérifier les éléments listés et leur propriété CSS width/min-width.",
    };
  } catch (err) {
    const error = err as Error;
    return {
      criterion: "10.11",
      criterionTitle: "Pas de défilement horizontal à 320px",
      passed: false,
      detail: `Vérification impossible : ${error.message}`,
      wcagReference: "1.4.10 Reflow (AA)",
    };
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }
  }
}

export async function checkTextSpacing(page: Page): Promise<BehavioralResult> {
  let styleHandle: string | null = null;
  try {
    // Inject spacing CSS and capture the element handle ID to remove it later
    styleHandle = await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "__rgaa_spacing_test__";
      style.textContent = `* {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }`;
      document.head.appendChild(style);
      return style.id;
    });

    await page.waitForTimeout(600);

    const overflowingElements = await page.evaluate(() => {
      const results: Array<{ tag: string; text: string; className: string }> = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      const checkedParents = new Set<Element>();
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = (node as Text).parentElement;
        if (!parent || checkedParents.has(parent)) continue;
        checkedParents.add(parent);

        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (style.overflow === "hidden" || style.overflow === "clip") {
          const isOverflowing =
            parent.scrollHeight > parent.clientHeight + 2 ||
            parent.scrollWidth > parent.clientWidth + 2;
          if (isOverflowing) {
            results.push({
              tag: parent.tagName.toLowerCase(),
              text: parent.textContent?.trim().slice(0, 60) ?? "",
              className: parent.className?.toString().slice(0, 40) ?? "",
            });
            if (results.length >= 5) break;
          }
        }
      }
      return results;
    });

    // Remove injected style
    await page.evaluate(() => {
      document.getElementById("__rgaa_spacing_test__")?.remove();
    });
    await page.waitForTimeout(300);

    if (overflowingElements.length === 0) {
      return {
        criterion: "10.12",
        criterionTitle: "Espacement du texte sans perte de contenu",
        passed: true,
        detail:
          "Aucune perte de contenu détectée lors de l'application des espacements WCAG 1.4.12.",
        wcagReference: "1.4.12 Text Spacing (AA)",
      };
    }

    const elements = overflowingElements
      .map((e) => `<${e.tag}> "${e.text}"`)
      .join(", ");

    return {
      criterion: "10.12",
      criterionTitle: "Espacement du texte sans perte de contenu",
      passed: false,
      detail: `${overflowingElements.length} élément(s) avec du contenu tronqué après application des espacements : ${elements}`,
      wcagReference: "1.4.12 Text Spacing (AA)",
      howToFix:
        "Éviter overflow:hidden sur les conteneurs de texte, ou utiliser overflow:auto. Ne pas contraindre la hauteur des éléments contenant du texte avec height fixe.",
    };
  } catch (err) {
    const error = err as Error;
    // Attempt cleanup even on error
    if (styleHandle) {
      await page
        .evaluate(() => document.getElementById("__rgaa_spacing_test__")?.remove())
        .catch(() => undefined);
    }
    return {
      criterion: "10.12",
      criterionTitle: "Espacement du texte sans perte de contenu",
      passed: false,
      detail: `Vérification impossible : ${error.message}`,
      wcagReference: "1.4.12 Text Spacing (AA)",
    };
  }
}

export async function checkMetaRefresh(page: Page): Promise<BehavioralResult> {
  try {
    const found = await page.evaluate(() => {
      const metaTags = document.querySelectorAll('meta[http-equiv="refresh"]');
      const results: Array<{ seconds: number; url: string | null; raw: string }> = [];
      for (const meta of metaTags) {
        const content = meta.getAttribute("content") ?? "";
        const parts = content.split(";");
        const seconds = parseInt(parts[0], 10);
        const url =
          parts[1]?.toLowerCase().trim().replace("url=", "") ?? null;
        results.push({ seconds, url, raw: content });
      }
      return results;
    });

    if (found.length === 0) {
      return {
        criterion: "13.1",
        criterionTitle: "Pas de rafraîchissement automatique",
        passed: true,
        detail: "Aucune balise <meta http-equiv='refresh'> détectée.",
        wcagReference: "2.2.1 Timing Adjustable (A)",
      };
    }

    const first = found[0];

    if (first.seconds === 0) {
      return {
        criterion: "13.1",
        criterionTitle: "Pas de rafraîchissement automatique",
        passed: false,
        detail: `Redirection instantanée détectée : <meta http-equiv="refresh" content="${first.raw}">. L'utilisateur n'a aucun contrôle sur cette redirection.`,
        wcagReference: "2.2.1 Timing Adjustable (A)",
        howToFix:
          "Utiliser une redirection côté serveur (301/302) ou laisser l'utilisateur contrôler la navigation. Ne jamais utiliser meta refresh avec content='0'.",
      };
    }

    return {
      criterion: "13.1",
      criterionTitle: "Pas de rafraîchissement automatique",
      passed: false,
      detail: `Rafraîchissement automatique dans ${first.seconds} secondes détecté. Les utilisateurs de technologies d'assistance peuvent ne pas avoir le temps de lire le contenu.`,
      wcagReference: "2.2.1 Timing Adjustable (A)",
      howToFix:
        "Supprimer le meta refresh ou fournir un mécanisme permettant à l'utilisateur de désactiver, ajuster ou prolonger le délai.",
    };
  } catch (err) {
    const error = err as Error;
    return {
      criterion: "13.1",
      criterionTitle: "Pas de rafraîchissement automatique",
      passed: false,
      detail: `Vérification impossible : ${error.message}`,
      wcagReference: "2.2.1 Timing Adjustable (A)",
    };
  }
}
