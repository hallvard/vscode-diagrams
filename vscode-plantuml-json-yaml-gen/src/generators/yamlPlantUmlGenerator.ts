import * as path from "node:path";
import * as vscode from "vscode";

import { PlantUmlGenerator } from "vscode-plantuml-gen-api";

export class YamlPlantUmlGenerator implements PlantUmlGenerator {
  public supportsSourceUri(sourceUri: vscode.Uri): boolean {
    const ext = path.posix.extname(sourceUri.path).toLowerCase();
    return ext === ".yaml" || ext === ".yml";
  }

  public generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string {
    const diagramName = path.posix.basename(sourceUri.path) || "yaml";
    return `@startyaml ${diagramName}\n${sourceText}\n@endyaml\n`;
  }
}
