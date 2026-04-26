#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runAudit } from "./audit.js";
import { enrichWithRGAA } from "./mapper.js";
import { getCriterion } from "./criteria.js";
import { formatReport } from "./report.js";

const server = new McpServer({
  name: "rgaa-mcp",
  version: "0.1.0",
});

server.registerTool(
  "rgaa_audit",
  {
    title: "RGAA Audit",
    description: "Audite une page web pour la conformité RGAA 4.1.2",
    inputSchema: z.object({
      url: z.string(),
      viewport: z.enum(["desktop", "mobile"]).default("desktop").optional(),
    }),
  },
  async ({ url, viewport = "desktop" }) => {
    try {
      try {
        new URL(url);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: `❌ URL invalide : "${url}". Veuillez fournir une URL complète (ex: https://example.com)`,
          }],
        };
      }

      console.error(`[rgaa-mcp] Starting audit: ${url} (${viewport})`);
      const raw = await runAudit(url, viewport);
      const enriched = await enrichWithRGAA(raw);
      const report = await formatReport(enriched);
      console.error(`[rgaa-mcp] Audit complete: ${enriched.summary.totalViolations} violations`);

      return {
        content: [{ type: "text" as const, text: report }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[rgaa-mcp] Audit error: ${message}`);
      return {
        content: [{
          type: "text" as const,
          text: `❌ Erreur lors de l'exécution de l'outil "rgaa_audit" :\n\n${message}\n\nVérifiez que l'URL est accessible et réessayez.`,
        }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "rgaa_criterion",
  {
    title: "RGAA Criterion",
    description: "Retourne les détails d'un critère RGAA 4.1.2",
    inputSchema: z.object({
      id: z.string(),
    }),
  },
  async ({ id }) => {
    try {
      const validFormat = /^\d+\.\d+$/.test(id);
      if (!validFormat) {
        return {
          content: [{
            type: "text" as const,
            text: `❌ Format invalide : "${id}". Utilisez le format "theme.numéro" (ex: "1.1", "3.2", "11.13")`,
          }],
        };
      }

      const criterion = await getCriterion(id);

      if (!criterion) {
        return {
          content: [{
            type: "text" as const,
            text: `❌ Critère "${id}" introuvable. Utilisez un ID valide entre 1.1 et 13.12.`,
          }],
        };
      }

      const lines: string[] = [
        `# Critère RGAA ${criterion.id} — Niveau ${criterion.level}`,
        ``,
        `## ${criterion.title}`,
        ``,
        `**Thème :** ${criterion.themeName}`,
        `**Niveau WCAG :** ${criterion.level}`,
        `**Références WCAG :** ${criterion.wcagReferences.join(", ") || "N/A"}`,
        ``,
        `## Tests`,
        ``,
      ];

      for (const test of criterion.tests) {
        lines.push(`### Test ${test.id}`);
        lines.push(test.title);
        lines.push(``);
      }

      if (criterion.specialCases.length > 0) {
        lines.push(`## Cas particuliers`);
        lines.push(``);
        for (const sc of criterion.specialCases) {
          lines.push(`- ${sc}`);
        }
        lines.push(``);
      }

      if (criterion.technicalNotes.length > 0) {
        lines.push(`## Notes techniques`);
        lines.push(``);
        for (const note of criterion.technicalNotes) {
          lines.push(`- ${note}`);
        }
        lines.push(``);
      }

      if (criterion.methodology) {
        lines.push(`## Méthodologie de test`);
        lines.push(``);
        lines.push(criterion.methodology);
        lines.push(``);
      }

      lines.push(`---`);
      lines.push(`_Source : [DISIC/accessibilite.numerique.gouv.fr](https://github.com/DISIC/accessibilite.numerique.gouv.fr)_`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[rgaa-mcp] Criterion error: ${message}`);
      return {
        content: [{
          type: "text" as const,
          text: `❌ Erreur lors de l'exécution de l'outil "rgaa_criterion" :\n\n${message}\n\nVérifiez que l'URL est accessible et réessayez.`,
        }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("RGAA MCP Server running");
