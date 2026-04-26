const CRITERIA_URL =
  "https://raw.githubusercontent.com/DISIC/accessibilite.numerique.gouv.fr/main/RGAA/criteres.json";
const METHODOLOGIES_URL =
  "https://raw.githubusercontent.com/DISIC/accessibilite.numerique.gouv.fr/main/RGAA/methodologies.json";

export interface RGAATest {
  id: string;
  title: string;
}

export interface RGAACriterion {
  id: string;
  themeId: number;
  themeName: string;
  number: number;
  title: string;
  level: "A" | "AA" | "AAA";
  tests: RGAATest[];
  specialCases: string[];
  technicalNotes: string[];
  wcagReferences: string[];
  methodology?: string;
}

// Module-level cache — fetched once per process lifetime
let criteriaCache: RGAACriterion[] | null = null;

function stripMarkdownLinks(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1");
}

function extractLevel(wcagRefs: string[]): "A" | "AA" | "AAA" {
  for (const ref of wcagRefs) {
    if (ref.includes("(AAA)")) return "AAA";
    if (ref.includes("(AA)")) return "AA";
    if (ref.includes("(A)")) return "A";
  }
  return "AA";
}

// Minimal fallback criteria when GitHub is unreachable
function buildFallback(): RGAACriterion[] {
  const fallbackData: Array<Omit<RGAACriterion, "title"> & { title: string }> = [
    { id: "1.1", themeId: 1, themeName: "Images", number: 1, title: "Chaque image porteuse d'information a-t-elle une alternative textuelle ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["1.1.1 Non-text Content (A)"] },
    { id: "1.2", themeId: 1, themeName: "Images", number: 2, title: "Chaque image de décoration est-elle correctement ignorée par les technologies d'assistance ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["1.1.1 Non-text Content (A)"] },
    { id: "3.2", themeId: 3, themeName: "Couleurs", number: 2, title: "Dans chaque page web, le contraste entre la couleur du texte et la couleur de son arrière-plan est-il suffisamment élevé ?", level: "AA", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["1.4.3 Contrast (Minimum) (AA)"] },
    { id: "6.1", themeId: 6, themeName: "Liens", number: 1, title: "Chaque lien est-il explicite ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["2.4.4 Link Purpose (In Context) (A)"] },
    { id: "8.3", themeId: 8, themeName: "Éléments obligatoires", number: 3, title: "Dans chaque page web, la langue par défaut est-elle présente ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["3.1.1 Language of Page (A)"] },
    { id: "8.4", themeId: 8, themeName: "Éléments obligatoires", number: 4, title: "Dans chaque page web, la langue par défaut est-elle pertinente ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["3.1.1 Language of Page (A)"] },
    { id: "8.5", themeId: 8, themeName: "Éléments obligatoires", number: 5, title: "Dans chaque page web, le titre de la page est-il pertinent ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["2.4.2 Page Titled (A)"] },
    { id: "11.1", themeId: 11, themeName: "Formulaires", number: 1, title: "Chaque champ de formulaire a-t-il une étiquette ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["1.3.1 Info and Relationships (A)"] },
    { id: "11.9", themeId: 11, themeName: "Formulaires", number: 9, title: "Dans chaque formulaire, l'intitulé de chaque bouton est-il pertinent ?", level: "A", tests: [], specialCases: [], technicalNotes: [], wcagReferences: ["2.4.6 Headings and Labels (AA)"] },
  ];

  return fallbackData.map((c) => ({
    ...c,
    title: `[données locales] ${c.title}`,
  }));
}

type CriteriaEntry = string | { ul: string[] };

type CriteriaJson = {
  topics: Array<{
    number: number;
    topic: string;
    criteria: Array<{
      criterium: {
        number: number;
        title: string;
        tests: Record<string, string[]>;
        references?: Array<{ wcag?: string[]; techniques?: string[] }>;
        particularCases?: CriteriaEntry[];
        technicalNote?: CriteriaEntry[];
      };
    }>;
  }>;
};

function flattenEntries(entries: CriteriaEntry[]): string[] {
  return entries.flatMap((e) =>
    typeof e === "string" ? [e] : (e.ul ?? [])
  );
}

type MethodologiesJson = Record<string, string>;

async function loadCriteria(): Promise<RGAACriterion[]> {
  if (criteriaCache !== null) return criteriaCache;

  try {
    const [criteriaRes, methodologiesRes] = await Promise.all([
      fetch(CRITERIA_URL),
      fetch(METHODOLOGIES_URL),
    ]);

    if (!criteriaRes.ok || !methodologiesRes.ok) {
      throw new Error("Fetch failed");
    }

    const [criteriaRaw, methodologiesRaw] = await Promise.all([
      criteriaRes.json() as Promise<CriteriaJson>,
      methodologiesRes.json() as Promise<MethodologiesJson>,
    ]);

    const result: RGAACriterion[] = [];

    for (const topic of criteriaRaw.topics) {
      for (const entry of topic.criteria) {
        const c = entry.criterium;
        const criterionId = `${topic.number}.${c.number}`;

        const wcagRefs = c.references
          ?.flatMap((r) => r.wcag ?? [])
          .map(stripMarkdownLinks) ?? [];

        const tests: RGAATest[] = Object.entries(c.tests ?? {}).map(
          ([key, lines]) => ({
            id: `${topic.number}.${c.number}.${key}`,
            title: stripMarkdownLinks(lines.join(" — ")),
          })
        );

        // Attach methodology from the first test
        const firstTestId = `${topic.number}.${c.number}.1`;
        const methodology = methodologiesRaw[firstTestId];

        result.push({
          id: criterionId,
          themeId: topic.number,
          themeName: topic.topic,
          number: c.number,
          title: stripMarkdownLinks(c.title),
          level: extractLevel(wcagRefs),
          tests,
          specialCases: flattenEntries(c.particularCases ?? []).map(stripMarkdownLinks),
          technicalNotes: flattenEntries(c.technicalNote ?? []).map(stripMarkdownLinks),
          wcagReferences: wcagRefs,
          methodology,
        });
      }
    }

    criteriaCache = result;
    return result;
  } catch (err) {
    console.error(
      "[rgaa-mcp] Impossible de charger les critères RGAA depuis GitHub — utilisation du fallback local:", err
    );
    criteriaCache = buildFallback();
    return criteriaCache;
  }
}

export async function getCriterion(
  id: string
): Promise<RGAACriterion | undefined> {
  const all = await loadCriteria();
  return all.find((c) => c.id === id);
}

export async function getCriteriaByTheme(
  themeId: number
): Promise<RGAACriterion[]> {
  const all = await loadCriteria();
  return all.filter((c) => c.themeId === themeId);
}

export async function getAllCriteria(): Promise<RGAACriterion[]> {
  return loadCriteria();
}

export async function getThemes(): Promise<
  Array<{ id: number; name: string; criteriaCount: number }>
> {
  const all = await loadCriteria();
  const map = new Map<number, { name: string; count: number }>();

  for (const c of all) {
    const existing = map.get(c.themeId);
    if (existing) {
      existing.count++;
    } else {
      map.set(c.themeId, { name: c.themeName, count: 1 });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, { name, count }]) => ({ id, name, criteriaCount: count }));
}
