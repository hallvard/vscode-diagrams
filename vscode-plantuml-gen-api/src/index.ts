import * as vscode from "vscode";
import { URLSearchParams } from "node:url";

export const PLANTUML_CORE_EXTENSION_ID = "local.vscode-plantuml-core-gen";

export interface PlantUmlGenerator {
  supportsSourceUri(sourceUri: vscode.Uri): boolean;
  generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string | Promise<string>;
}

export interface PlantUmlCoreApi {
  registerGenerator(genKey: string, generator: PlantUmlGenerator): vscode.Disposable;
}
