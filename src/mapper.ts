import type { AuditRawResult, AxeNode } from "./audit.js";

export type { AxeNode };

export interface RGAAViolation {
  axeRuleId: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
  rgaaCriteriaIds: string[];
  rgaaTheme: string;
  automatable: true;
  unmapped: boolean;
}

export interface EnrichedAuditResult {
  url: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
  viewport: "desktop" | "mobile";
  violations: RGAAViolation[];
  behavioral: AuditRawResult["behavioral"];
  summary: {
    totalViolations: number;
    unmappedViolations: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    affectedRGAACriteria: string[];
  };
  passes: number;
  incomplete: number;
  inapplicable: number;
}

const AXE_TO_RGAA: Record<string, { criteriaIds: string[]; theme: string }> = {
  // Theme 1 — Images
  "image-alt":           { criteriaIds: ["1.1", "1.2"], theme: "Images" },
  "input-image-alt":     { criteriaIds: ["1.1"],        theme: "Images" },
  "area-alt":            { criteriaIds: ["1.1"],        theme: "Images" },
  "image-redundant-alt": { criteriaIds: ["1.3"],        theme: "Images" },
  "role-img-alt":        { criteriaIds: ["1.1", "1.3"], theme: "Images" },

  // Theme 2 — Cadres
  "frame-title":             { criteriaIds: ["2.1"], theme: "Cadres" },
  "frame-focusable-content": { criteriaIds: ["2.1"], theme: "Cadres" },

  // Theme 3 — Couleurs
  "color-contrast":          { criteriaIds: ["3.2"], theme: "Couleurs" },
  "color-contrast-enhanced": { criteriaIds: ["3.2"], theme: "Couleurs" },

  // Theme 5 — Tableaux
  "table-duplicate-name": { criteriaIds: ["5.4"], theme: "Tableaux" },
  "table-fake-caption":   { criteriaIds: ["5.4"], theme: "Tableaux" },
  "td-headers-attr":      { criteriaIds: ["5.7"], theme: "Tableaux" },
  "th-has-data-cells":    { criteriaIds: ["5.7"], theme: "Tableaux" },
  "scope-attr-valid":     { criteriaIds: ["5.7"], theme: "Tableaux" },
  "td-has-header":        { criteriaIds: ["5.7"], theme: "Tableaux" },

  // Theme 6 — Liens
  "link-name":          { criteriaIds: ["6.1"], theme: "Liens" },
  "link-in-text-block": { criteriaIds: ["6.3"], theme: "Liens" },

  // Theme 8 — Éléments obligatoires
  "html-has-lang":          { criteriaIds: ["8.3", "8.4"], theme: "Éléments obligatoires" },
  "html-lang-valid":        { criteriaIds: ["8.4"],        theme: "Éléments obligatoires" },
  "html-xml-lang-mismatch": { criteriaIds: ["8.4"],        theme: "Éléments obligatoires" },
  "valid-lang":             { criteriaIds: ["8.8"],        theme: "Éléments obligatoires" },
  "document-title":         { criteriaIds: ["8.5"],        theme: "Éléments obligatoires" },
  "duplicate-id":           { criteriaIds: ["8.1"],        theme: "Éléments obligatoires" },
  "duplicate-id-active":    { criteriaIds: ["8.1"],        theme: "Éléments obligatoires" },
  "duplicate-id-aria":      { criteriaIds: ["8.1"],        theme: "Éléments obligatoires" },
  "meta-refresh":           { criteriaIds: ["13.1"],       theme: "Consultation" },
  "meta-viewport":          { criteriaIds: ["13.9"],       theme: "Consultation" },

  // Theme 9 — Structure
  "heading-order":       { criteriaIds: ["9.1"], theme: "Structure" },
  "page-has-heading-one":{ criteriaIds: ["9.1"], theme: "Structure" },
  "landmark-one-main":   { criteriaIds: ["9.2"], theme: "Structure" },

  // Theme 12 — Navigation
  "landmark-banner-is-top-level":        { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-complementary-is-top-level": { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-contentinfo-is-top-level":   { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-main-is-top-level":          { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-no-duplicate-banner":        { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-no-duplicate-contentinfo":   { criteriaIds: ["12.6"], theme: "Navigation" },
  "landmark-no-duplicate-main":          { criteriaIds: ["12.6"], theme: "Navigation" },

  // Theme 10 — Consultation
  "css-orientation-lock": { criteriaIds: ["13.9"], theme: "Consultation" },

  // Theme 11 — Formulaires
  "label":                    { criteriaIds: ["11.1"],  theme: "Formulaires" },
  "label-content-name-mismatch": { criteriaIds: ["11.2"], theme: "Formulaires" },
  "label-title-only":         { criteriaIds: ["11.1"],  theme: "Formulaires" },
  "select-name":              { criteriaIds: ["11.1"],  theme: "Formulaires" },
  "autocomplete-valid":       { criteriaIds: ["11.13"], theme: "Formulaires" },
  "form-field-multiple-labels":{ criteriaIds: ["11.1"], theme: "Formulaires" },
  "button-name":              { criteriaIds: ["11.9"],  theme: "Formulaires" },

  // Navigation
  "skip-link":                  { criteriaIds: ["12.5"], theme: "Navigation" },
  "tabindex":                   { criteriaIds: ["12.8"], theme: "Navigation" },
  "scrollable-region-focusable":{ criteriaIds: ["12.1"], theme: "Navigation" },
  "accesskeys":                 { criteriaIds: ["12.1"], theme: "Navigation" },

  // Présentation
  "interactive-supports-focus": { criteriaIds: ["10.3"], theme: "Présentation" },
  "aria-hidden-focus":          { criteriaIds: ["10.8"], theme: "Présentation" },

  // ARIA / Éléments obligatoires
  "nested-interactive":        { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-allowed-attr":         { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-allowed-role":         { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-hidden-body":          { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-required-attr":        { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-required-children":    { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-required-parent":      { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-roles":                { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-valid-attr":           { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-valid-attr-value":     { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-conditional-attr":     { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },
  "aria-deprecated-role":      { criteriaIds: ["8.2"], theme: "Éléments obligatoires" },

  // ARIA / Scripts
  "aria-command-name":     { criteriaIds: ["7.1"], theme: "Scripts" },
  "aria-meter-name":       { criteriaIds: ["7.1"], theme: "Scripts" },
  "aria-progressbar-name": { criteriaIds: ["7.1"], theme: "Scripts" },
  "aria-tooltip-name":     { criteriaIds: ["7.1"], theme: "Scripts" },
  "aria-dialog-name":      { criteriaIds: ["7.1"], theme: "Scripts" },

  // ARIA / Formulaires
  "aria-input-field-name":  { criteriaIds: ["11.1"], theme: "Formulaires" },
  "aria-toggle-field-name": { criteriaIds: ["11.1"], theme: "Formulaires" },
};

export function enrichWithRGAA(raw: AuditRawResult): EnrichedAuditResult {
  const violations: RGAAViolation[] = raw.axe.violations.map((v) => {
    const mapping = AXE_TO_RGAA[v.id];
    if (mapping) {
      return {
        axeRuleId: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes,
        rgaaCriteriaIds: mapping.criteriaIds,
        rgaaTheme: mapping.theme,
        automatable: true,
        unmapped: false,
      };
    }
    return {
      axeRuleId: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes,
      rgaaCriteriaIds: [],
      rgaaTheme: "Non mappé",
      automatable: true,
      unmapped: true,
    };
  });

  const allCriteriaIds = violations
    .filter((v) => !v.unmapped)
    .flatMap((v) => v.rgaaCriteriaIds);

  const affectedRGAACriteria = [...new Set(allCriteriaIds)].sort((a, b) => {
    const [aMajor, aMinor] = a.split(".").map(Number);
    const [bMajor, bMinor] = b.split(".").map(Number);
    return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
  });

  return {
    url: raw.url,
    pageUrl: raw.pageUrl,
    pageTitle: raw.pageTitle,
    timestamp: raw.timestamp,
    viewport: raw.viewport,
    violations,
    behavioral: raw.behavioral,
    summary: {
      totalViolations: violations.length,
      unmappedViolations: violations.filter((v) => v.unmapped).length,
      criticalCount: violations.filter((v) => v.impact === "critical").length,
      seriousCount: violations.filter((v) => v.impact === "serious").length,
      moderateCount: violations.filter((v) => v.impact === "moderate").length,
      minorCount: violations.filter((v) => v.impact === "minor").length,
      affectedRGAACriteria,
    },
    passes: raw.axe.passes,
    incomplete: raw.axe.incomplete,
    inapplicable: raw.axe.inapplicable,
  };
}
