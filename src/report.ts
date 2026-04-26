import type { EnrichedAuditResult, RGAAViolation } from "./mapper.js";
import { getCriterion } from "./criteria.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateHtml(html: string, max = 200): string {
  if (html.length <= max) return html;
  return html.slice(0, max) + "...";
}

function sortCriterionIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const [aTheme, aCrit] = a.split(".").map(Number);
    const [bTheme, bCrit] = b.split(".").map(Number);
    if (aTheme !== bTheme) return aTheme - bTheme;
    return aCrit - bCrit;
  });
}

function impactEmoji(impact: string): string {
  switch (impact) {
    case "critical": return "🔴";
    case "serious":  return "🟠";
    case "moderate": return "🟡";
    case "minor":    return "🟢";
    default:         return "⚪";
  }
}

function formatViolation(v: RGAAViolation): string {
  const lines: string[] = [];
  lines.push(`#### ${impactEmoji(v.impact)} ${v.help} — \`${v.axeRuleId}\``);
  lines.push(``);
  lines.push(v.description);
  lines.push(``);
  lines.push(`**Éléments concernés (${v.nodes.length}) :**`);
  lines.push(``);

  const displayed = v.nodes.slice(0, 3);
  for (const node of displayed) {
    lines.push("```html");
    lines.push(truncateHtml(node.html));
    lines.push("```");
    lines.push(`> ${node.failureSummary}`);
    lines.push(``);
  }

  if (v.nodes.length > 3) {
    lines.push(`_... et ${v.nodes.length - 3} autre(s) élément(s) non affichés_`);
    lines.push(``);
  }

  lines.push(`🔗 [Documentation axe-core](${v.helpUrl})`);
  return lines.join("\n");
}

export async function formatReport(result: EnrichedAuditResult): Promise<string> {
  const lines: string[] = [];

  // Section 1 — Header
  const viewportLabel =
    result.viewport === "desktop" ? "Desktop 1280×800" : "Mobile 375×667";

  lines.push(`# Audit RGAA 4.1.2 — ${result.pageTitle}`);
  lines.push(``);
  lines.push(`**URL :** ${result.pageUrl}`);
  lines.push(`**Date :** ${formatDate(result.timestamp)}`);
  lines.push(`**Viewport :** ${viewportLabel}`);
  lines.push(`**Outil :** rgaa-mcp v0.1.0`);
  lines.push(``);

  // Section 2 — Summary table
  const { summary } = result;
  const criteriaList =
    summary.affectedRGAACriteria.length > 0
      ? summary.affectedRGAACriteria.join(", ")
      : "Aucun";

  lines.push(`## Résumé`);
  lines.push(``);
  lines.push(`| Indicateur | Résultat |`);
  lines.push(`|------------|----------|`);
  lines.push(`| 🔴 Violations critiques | ${summary.criticalCount} |`);
  lines.push(`| 🟠 Violations sérieuses | ${summary.seriousCount} |`);
  lines.push(`| 🟡 Violations modérées | ${summary.moderateCount} |`);
  lines.push(`| 🟢 Violations mineures | ${summary.minorCount} |`);
  lines.push(`| ✅ Règles passées | ${result.passes} |`);
  lines.push(`| ⚠️ Incomplets (vérif. manuelle) | ${result.incomplete} |`);
  lines.push(`| **Critères RGAA impactés** | **${criteriaList}** |`);
  lines.push(``);

  if (summary.totalViolations === 0) {
    lines.push(`✅ **Aucune violation automatisée détectée sur cette page.**`);
    lines.push(``);
  }

  // Section 3 — Behavioral checks
  lines.push(`## Vérifications comportementales`);
  lines.push(``);
  lines.push(`| Critère | Intitulé | Résultat |`);
  lines.push(`|---------|----------|----------|`);
  for (const b of result.behavioral) {
    const status = b.passed ? "✅ Conforme" : "❌ Non conforme";
    lines.push(`| ${b.criterion} | ${b.criterionTitle} | ${status} |`);
  }
  lines.push(``);

  for (const b of result.behavioral.filter((b) => !b.passed)) {
    lines.push(`### ❌ Critère ${b.criterion} — ${b.criterionTitle}`);
    lines.push(``);
    lines.push(b.detail);
    lines.push(``);
    if (b.howToFix) {
      lines.push(`💡 **Correction suggérée :** ${b.howToFix}`);
      lines.push(``);
    }
  }

  // Section 4 — Violations grouped by RGAA criterion
  lines.push(`## Violations détectées`);
  lines.push(``);

  const mapped = result.violations.filter((v) => !v.unmapped);
  const unmapped = result.violations.filter((v) => v.unmapped);

  if (result.violations.length === 0) {
    lines.push(`Aucune violation automatisée détectée.`);
    lines.push(``);
  } else {
    // Build map: criterionId → violations
    const bycriterion = new Map<string, RGAAViolation[]>();
    for (const v of mapped) {
      for (const cid of v.rgaaCriteriaIds) {
        if (!bycriterion.has(cid)) bycriterion.set(cid, []);
        bycriterion.get(cid)!.push(v);
      }
    }

    const sortedIds = sortCriterionIds([...bycriterion.keys()]);

    for (const cid of sortedIds) {
      const violations = bycriterion.get(cid)!;
      const criterion = await getCriterion(cid);
      const title = criterion?.title ?? `Critère ${cid}`;
      const theme = violations[0].rgaaTheme;
      const level = criterion?.level ?? "?";

      lines.push(`### Critère ${cid} — ${title}`);
      lines.push(`**Niveau :** ${level} | **Thème :** ${theme} | **Violations :** ${violations.length}`);
      lines.push(``);

      for (let i = 0; i < violations.length; i++) {
        lines.push(formatViolation(violations[i]));
        if (i < violations.length - 1) {
          lines.push(``);
          lines.push(`---`);
          lines.push(``);
        }
      }
      lines.push(``);
    }

    if (unmapped.length > 0) {
      lines.push(`### Règles sans correspondance RGAA`);
      lines.push(`_Ces violations axe-core n'ont pas de correspondance RGAA connue.`);
      lines.push(`Elles peuvent indiquer des problèmes d'accessibilité non couverts par`);
      lines.push(`le référentiel._`);
      lines.push(``);
      for (let i = 0; i < unmapped.length; i++) {
        lines.push(formatViolation(unmapped[i]));
        if (i < unmapped.length - 1) {
          lines.push(``);
          lines.push(`---`);
          lines.push(``);
        }
      }
      lines.push(``);
    }
  }

  // Section 5 — Manual review
  lines.push(`## ⚠️ Critères nécessitant une vérification manuelle`);
  lines.push(``);
  lines.push(`Les critères suivants ne peuvent pas être testés automatiquement.`);
  lines.push(`Ils requièrent une évaluation humaine dans le cadre d'un audit complet.`);
  lines.push(``);
  lines.push(`### Pourquoi certains critères ne sont pas automatisables ?`);
  lines.push(`Le RGAA demande non seulement que certains éléments *existent* dans le code,`);
  lines.push(`mais aussi qu'ils soient *pertinents* et *de qualité* — ce qui nécessite`);
  lines.push(`un jugement humain.`);
  lines.push(``);
  lines.push(`| Critère | Thème | Raison |`);
  lines.push(`|---------|-------|--------|`);
  const manualCriteria = [
    ["1.3",  "Images",            "Pertinence de l'alternative textuelle"],
    ["1.6",  "Images",            "Existence d'une description détaillée"],
    ["1.7",  "Images",            "Pertinence de la description détaillée"],
    ["1.8",  "Images",            "Image texte remplaçable par du texte stylé"],
    ["1.9",  "Images",            "Cohérence légende et alternative"],
    ["2.2",  "Cadres",            "Pertinence du titre de cadre"],
    ["3.1",  "Couleurs",          "Information donnée uniquement par la couleur"],
    ["4.1",  "Multimédia",        "Transcription textuelle"],
    ["4.2",  "Multimédia",        "Sous-titres synchronisés"],
    ["4.3",  "Multimédia",        "Audiodescription synchronisée"],
    ["4.4",  "Multimédia",        "Pertinence des sous-titres"],
    ["4.5",  "Multimédia",        "Pertinence de l'audiodescription"],
    ["4.6",  "Multimédia",        "Sous-titres en direct"],
    ["4.7",  "Multimédia",        "Contrôle du son"],
    ["4.8",  "Multimédia",        "Vidéo sans audio"],
    ["4.9",  "Multimédia",        "Audio seul"],
    ["4.10", "Multimédia",        "Son déclenché automatiquement"],
    ["5.1",  "Tableaux",          "Résumé du tableau complexe"],
    ["5.2",  "Tableaux",          "Pertinence du résumé"],
    ["5.5",  "Tableaux",          "Pertinence du titre du tableau"],
    ["5.6",  "Tableaux",          "Pertinence des en-têtes"],
    ["6.2",  "Liens",             "Nom accessible du lien"],
    ["6.3",  "Liens",             "Intitulé de lien hors contexte"],
    ["7.2",  "Scripts",           "Alternative aux scripts"],
    ["7.4",  "Scripts",           "Changement de contexte"],
    ["8.6",  "Élts obligatoires", "Pertinence du titre de page"],
    ["8.9",  "Élts obligatoires", "Balises non utilisées pour la mise en forme"],
    ["8.10", "Élts obligatoires", "Citations balisées correctement"],
    ["9.3",  "Structure",         "Listes balisées correctement"],
    ["10.1", "Présentation",      "CSS seul pour la présentation"],
    ["10.2", "Présentation",      "Contenu CSS généré informatif"],
    ["10.6", "Présentation",      "Liens distinguables du texte"],
    ["10.7", "Présentation",      "Prise de focus visible"],
    ["11.2", "Formulaires",       "Pertinence de l'étiquette"],
    ["11.5", "Formulaires",       "Champs de même nature regroupés"],
    ["11.7", "Formulaires",       "Pertinence de la légende"],
    ["11.11","Formulaires",       "Suggestions d'erreur"],
    ["11.12","Formulaires",       "Contrôle des données"],
    ["12.1", "Navigation",        "Système de navigation"],
    ["12.2", "Navigation",        "Navigation cohérente"],
    ["12.7", "Navigation",        "Ordre de tabulation cohérent"],
    ["12.8", "Navigation",        "Pas de piège clavier"],
    ["13.3", "Consultation",      "Documents téléchargeables accessibles"],
    ["13.6", "Consultation",      "Format et indication des fichiers"],
    ["13.7", "Consultation",      "Timeout avec avertissement"],
    ["13.9", "Consultation",      "Orientation portrait et paysage"],
  ];
  for (const [id, theme, reason] of manualCriteria) {
    lines.push(`| ${id} | ${theme} | ${reason} |`);
  }
  lines.push(``);

  // Section 6 — Footer
  lines.push(`---`);
  lines.push(`_Rapport généré par [rgaa-mcp](https://www.npmjs.com/package/rgaa-mcp) v0.1.0_`);
  lines.push(`_Critères source : [DISIC/accessibilite.numerique.gouv.fr](https://github.com/DISIC/accessibilite.numerique.gouv.fr)_`);
  lines.push(`_⚠️ Ce rapport couvre ~33 critères sur 106. Un audit complet nécessite une vérification humaine._`);

  return lines.join("\n");
}
