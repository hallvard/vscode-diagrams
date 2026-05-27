import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator, SourceContext } from "vscode-plantuml-gen-api";

const CREATE_TABLE_PREFIX_LENGTH = 512;
const CREATE_TABLE_REGEX = /\bcreate\s+table\b/i;

type Column = {
  name: string;
  type: string;
  isPrimaryKey: boolean;
};

type ForeignKey = {
  fromColumn: string;
  toTable: string;
  toColumn: string;
};

type Table = {
  name: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
};

export class SqlErPlantUmlGenerator implements PlantUmlGenerator {
  public async supportsSourceUri(sourceContext: SourceContext): Promise<boolean> {
    const prefix = await sourceContext.getPrefix(CREATE_TABLE_PREFIX_LENGTH);
    const uncommentedPrefix = stripSqlComments(prefix);
    return CREATE_TABLE_REGEX.test(uncommentedPrefix);
  }

  public generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string {
    const diagramName = path.posix.basename(sourceUri.path, ".sql") || "sql-er";
    const sql = stripSqlComments(sourceText);
    const tables = parseTables(sql);

    const lines: string[] = [];

    for (const table of tables) {
      lines.push(`entity \"${table.name}\" as ${toAlias(table.name)} {`);
      const identifyingColumns = table.columns.filter((column) => column.isPrimaryKey);
      const nonIdentifyingColumns = table.columns.filter((column) => !column.isPrimaryKey);

      for (const column of identifyingColumns) {
        const typeSuffix = column.type ? ` : ${column.type}` : "";
        lines.push(`  * ${column.name}${typeSuffix}`);
      }

      if (identifyingColumns.length > 0 && nonIdentifyingColumns.length > 0) {
        lines.push("  --");
      }

      for (const column of nonIdentifyingColumns) {
        const typeSuffix = column.type ? ` : ${column.type}` : "";
        lines.push(`  ${column.name}${typeSuffix}`);
      }
      lines.push("}");
      lines.push("");
    }

    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        lines.push(
          `${toAlias(table.name)}::${fk.fromColumn} }o--|| ${toAlias(fk.toTable)}::${fk.toColumn}`
        );
      }
    }

    if (lines.length === 0) {
      lines.push("note \"No tables found in the provided SQL.\" as N1");
    }

    return [
      `@startuml ${diagramName}`,
      "hide circle",
      "skinparam linetype ortho",
      ...lines,
      "@enduml",
      ""
    ].join("\n");
  }
}

function parseTables(sql: string): Table[] {
  const tables: Table[] = [];
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w$.\"`\[\]]+)\s*\(([^]*?)\)\s*;/gi;

  let match = createTableRegex.exec(sql);
  while (match) {
    const tableName = normalizeIdentifier(match[1]);
    const definitionBody = match[2];
    const table = parseTableDefinition(tableName, definitionBody);
    tables.push(table);
    match = createTableRegex.exec(sql);
  }

  return tables;
}

function parseTableDefinition(tableName: string, definitionBody: string): Table {
  const columns: Column[] = [];
  const foreignKeys: ForeignKey[] = [];
  const primaryKeyColumns = new Set<string>();

  const parts = splitCommaSeparated(definitionBody);
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const unconstrainedPart = part.replace(/^constraint\s+[\w$."`\[\]]+\s+/i, "");
    const upperPart = part.toUpperCase();
    const upperUnconstrainedPart = unconstrainedPart.toUpperCase();

    if (upperPart.startsWith("CONSTRAINT")) {
      if (upperUnconstrainedPart.startsWith("PRIMARY KEY")) {
        const tablePkMatch = unconstrainedPart.match(/primary\s+key\s*\(([^)]+)\)/i);
        if (tablePkMatch) {
          for (const pkColumn of splitCommaSeparated(tablePkMatch[1])) {
            primaryKeyColumns.add(normalizeIdentifier(pkColumn.trim()));
          }
        }
      } else if (upperUnconstrainedPart.includes("FOREIGN KEY") && upperUnconstrainedPart.includes("REFERENCES")) {
        const tableFkMatch = unconstrainedPart.match(
          /foreign\s+key\s*\(([^)]+)\)\s*references\s+([\w$."`\[\]]+)\s*\(([^)]+)\)/i
        );
        if (tableFkMatch) {
          const fromColumns = splitCommaSeparated(tableFkMatch[1]).map((value) => normalizeIdentifier(value.trim()));
          const toTable = normalizeIdentifier(tableFkMatch[2]);
          const toColumns = splitCommaSeparated(tableFkMatch[3]).map((value) => normalizeIdentifier(value.trim()));

          const pairCount = Math.min(fromColumns.length, toColumns.length);
          for (let i = 0; i < pairCount; i += 1) {
            foreignKeys.push({
              fromColumn: fromColumns[i],
              toTable,
              toColumn: toColumns[i]
            });
          }
        }
      }

      continue;
    }

    if (upperPart.startsWith("PRIMARY KEY")) {
      const tablePkMatch = part.match(/primary\s+key\s*\(([^)]+)\)/i);
      if (tablePkMatch) {
        for (const pkColumn of splitCommaSeparated(tablePkMatch[1])) {
          primaryKeyColumns.add(normalizeIdentifier(pkColumn.trim()));
        }
      }
      continue;
    }

    if (upperPart.includes("FOREIGN KEY") && upperPart.includes("REFERENCES")) {
      const tableFkMatch = part.match(
        /foreign\s+key\s*\(([^)]+)\)\s*references\s+([\w$.\"`\[\]]+)\s*\(([^)]+)\)/i
      );
      if (tableFkMatch) {
        const fromColumns = splitCommaSeparated(tableFkMatch[1]).map((value) => normalizeIdentifier(value.trim()));
        const toTable = normalizeIdentifier(tableFkMatch[2]);
        const toColumns = splitCommaSeparated(tableFkMatch[3]).map((value) => normalizeIdentifier(value.trim()));

        const pairCount = Math.min(fromColumns.length, toColumns.length);
        for (let i = 0; i < pairCount; i += 1) {
          foreignKeys.push({
            fromColumn: fromColumns[i],
            toTable,
            toColumn: toColumns[i]
          });
        }
      }
      continue;
    }

    const column = parseColumnDefinition(part);
    if (column) {
      columns.push(column);
      if (column.isPrimaryKey) {
        primaryKeyColumns.add(column.name);
      }

      if (column.type) {
        const inlineReference = part.match(/references\s+([\w$.\"`\[\]]+)\s*\(([^)]+)\)/i);
        if (inlineReference) {
          foreignKeys.push({
            fromColumn: column.name,
            toTable: normalizeIdentifier(inlineReference[1]),
            toColumn: normalizeIdentifier(inlineReference[2].trim())
          });
        }
      }
    }
  }

  for (const column of columns) {
    if (primaryKeyColumns.has(column.name)) {
      column.isPrimaryKey = true;
    }
  }

  return {
    name: tableName,
    columns,
    foreignKeys
  };
}

function parseColumnDefinition(part: string): Column | undefined {
  const trimmed = part.trim();
  if (!trimmed) {
    return undefined;
  }

  const content = trimmed;
  const firstSpaceIndex = findFirstWhitespaceOutsideQuotes(content);
  if (firstSpaceIndex <= 0) {
    return undefined;
  }

  const rawName = content.slice(0, firstSpaceIndex);
  const remainder = content.slice(firstSpaceIndex).trim();
  if (!remainder) {
    return undefined;
  }

  const typeStop = remainder.search(/\s+(?:constraint|not\s+null|null|default|primary\s+key|unique|references|check|collate)\b/i);
  const type = (typeStop >= 0 ? remainder.slice(0, typeStop) : remainder).trim();
  const isPrimaryKey = /\bprimary\s+key\b/i.test(remainder);

  return {
    name: normalizeIdentifier(rawName),
    type,
    isPrimaryKey
  };
}

function splitCommaSeparated(content: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const previous = i > 0 ? content[i - 1] : "";

    if (!inDouble && !inBacktick && !inBracket && char === "'" && previous !== "\\") {
      inSingle = !inSingle;
      current += char;
      continue;
    }

    if (!inSingle && !inBacktick && !inBracket && char === '"' && previous !== "\\") {
      inDouble = !inDouble;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && !inBracket && char === "`") {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && char === "[") {
      inBracket = true;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && char === "]") {
      inBracket = false;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      if (char === "(") {
        depth += 1;
      } else if (char === ")" && depth > 0) {
        depth -= 1;
      } else if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

function stripSqlComments(sql: string): string {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments.replace(/--.*$/gm, "");
}

function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withoutQuotes = trimmed
    .split(".")
    .map((part) => part.trim().replace(/^"(.+)"$/, "$1").replace(/^`(.+)`$/, "$1").replace(/^\[(.+)\]$/, "$1"))
    .join(".");

  return withoutQuotes;
}

function toAlias(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9_]/g, "_");
}

function findFirstWhitespaceOutsideQuotes(value: string): number {
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (!inBacktick && !inBracket && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inDouble && !inBracket && char === "`") {
      inBacktick = !inBacktick;
      continue;
    }

    if (!inDouble && !inBacktick && char === "[") {
      inBracket = true;
      continue;
    }

    if (!inDouble && !inBacktick && char === "]") {
      inBracket = false;
      continue;
    }

    if (!inDouble && !inBacktick && !inBracket && /\s/.test(char)) {
      return i;
    }
  }

  return -1;
}
