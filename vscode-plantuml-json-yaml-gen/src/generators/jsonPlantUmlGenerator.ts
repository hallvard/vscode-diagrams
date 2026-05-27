import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator, SourceContext } from "vscode-plantuml-gen-api";

export class JsonPlantUmlGenerator implements PlantUmlGenerator {
  public supportsSourceUri(sourceContext: SourceContext): boolean {
    void sourceContext;
    return true;
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
