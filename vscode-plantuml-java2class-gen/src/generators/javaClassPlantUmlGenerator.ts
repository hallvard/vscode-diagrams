import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator, SourceContext } from "vscode-plantuml-gen-api";

type JavaTypeKind = "class" | "interface" | "enum";

type JavaMember = {
  visibility: string;
  name: string;
  detail?: string;
};

type JavaType = {
  kind: JavaTypeKind;
  name: string;
  fields: JavaMember[];
  methods: JavaMember[];
};

export class JavaClassPlantUmlGenerator implements PlantUmlGenerator {
  public supportsSourceUri(sourceContext: SourceContext): boolean {
    void sourceContext;
    return true;
  }

  public async generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): Promise<string> {
    const diagramName = path.posix.basename(sourceUri.path, ".java") || "java-class";
    const types = await collectJavaTypesFromDocumentSymbols(sourceUri);

    const lines: string[] = [];

    for (const type of types) {
      lines.push(`${type.kind} ${type.name} {`);

      for (const field of type.fields) {
        lines.push(`  ${field.visibility}${field.name}${formatDetail(field.detail)}`);
      }

      for (const method of type.methods) {
        lines.push(`  ${method.visibility}${method.name}${formatDetail(method.detail)}`);
      }

      lines.push("}", "");
    }

    if (lines.length === 0) {
      lines.push("note \"No Java type symbols found for this file.\" as N1");
    }

    return [
      `@startuml ${diagramName}`,
      "hide empty members",
      "",
      ...lines,
      "@enduml",
      ""
    ].join("\n");
  }
}

async function collectJavaTypesFromDocumentSymbols(sourceUri: vscode.Uri): Promise<JavaType[]> {
  const symbols = await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[]>(
    "vscode.executeDocumentSymbolProvider",
    sourceUri
  );

  if (!symbols) {
    return [];
  }

  const documentSymbols = symbols.filter(isDocumentSymbol);
  if (documentSymbols.length === 0) {
    return [];
  }

  const types: JavaType[] = [];
  for (const symbol of documentSymbols) {
    collectFromNode(symbol, types);
  }

  return types;
}

function collectFromNode(symbol: vscode.DocumentSymbol, types: JavaType[]): void {
  const kind = mapTypeKind(symbol.kind);
  if (kind) {
    types.push(extractJavaType(symbol, kind));
  }

  for (const child of symbol.children) {
    collectFromNode(child, types);
  }
}

function extractJavaType(symbol: vscode.DocumentSymbol, kind: JavaTypeKind): JavaType {
  const fields: JavaMember[] = [];
  const methods: JavaMember[] = [];

  for (const child of symbol.children) {
    const javaMember = {
      visibility: toVisibility(child.name),
      name: stripVisibilityMarker(child.name),
      detail: child.detail
    };
    if (child.kind === vscode.SymbolKind.Field || child.kind === vscode.SymbolKind.Property) {
      fields.push(javaMember);
    } else if (child.kind === vscode.SymbolKind.Method || child.kind === vscode.SymbolKind.Constructor) {
      methods.push(javaMember);
    }
  }

  return {
    kind,
    name: stripVisibilityMarker(symbol.name),
    fields,
    methods
  };
}

function mapTypeKind(kind: vscode.SymbolKind): JavaTypeKind | undefined {
  if (kind === vscode.SymbolKind.Class) {
    return "class";
  } else if (kind === vscode.SymbolKind.Interface) {
    return "interface";
  } else if (kind === vscode.SymbolKind.Enum) {
    return "enum";
  }
  return undefined;
}

function toVisibility(value: string): string {
  return value.length > 0 && "+-#~".includes(value[0]) ? value[0] : "~";
}

function stripVisibilityMarker(value: string): string {
  if (value.length > 1 && "+-#~".includes(value[0])) {
    value = value.slice(1);
  }
  return value.trim();
}

function formatDetail(detail: string | undefined): string {
  if (!detail || !detail.trim()) {
    return "";
  }

  const normalizedDetail = detail.trim().replace(/^:+\s*/, "");
  if (!normalizedDetail) {
    return "";
  }

  return ` : ${normalizedDetail}`;
}

function isDocumentSymbol(symbol: vscode.DocumentSymbol | vscode.SymbolInformation): symbol is vscode.DocumentSymbol {
  return "selectionRange" in symbol;
}
