import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator, SourceContext } from "vscode-plantuml-gen-api";

export class YamlPlantUmlGenerator implements PlantUmlGenerator {
  public supportsSourceUri(sourceContext: SourceContext): boolean {
    void sourceContext;
    return true;
  }

  public generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string {
    const diagramName = path.posix.basename(sourceUri.path) || "yaml";
    return `@startyaml ${diagramName}\n${sourceText}\n@endyaml\n`;
  }
}
