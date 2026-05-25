import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator } from "vscode-plantuml-gen-api";

export class JsonPlantUmlGenerator implements PlantUmlGenerator {
  public supportsSourceUri(sourceUri: vscode.Uri): boolean {
    return path.posix.extname(sourceUri.path).toLowerCase() === ".json";
  }

  public generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string {
    const diagramName = path.posix.basename(sourceUri.path) || "json";

    try {
      const parsed = JSON.parse(sourceText);
      const normalized = JSON.stringify(parsed, null, 2);
      return `@startjson ${diagramName}\n${normalized}\n@endjson\n`;
    } catch {
      // Keep behavior predictable: if invalid JSON, preserve source payload as-is.
      return `@startjson ${diagramName}\n${sourceText}\n@endjson\n`;
    }
  }
}
