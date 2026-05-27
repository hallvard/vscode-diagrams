import * as vscode from "vscode";
import { URLSearchParams } from "node:url";

import { SourceFilter } from "./sourceFilter";
import { SourceContext } from "./sourceContext";

export { SourceFilter } from "./sourceFilter";
export { SourceContext } from "./sourceContext";

export const PLANTUML_CORE_EXTENSION_ID = "local.vscode-plantuml-core-gen";

export interface PlantUmlGenerator {
  supportsSourceUri(sourceContext: SourceContext): boolean | Promise<boolean>;
  generate(sourceUri: vscode.Uri, sourceText: string, options: URLSearchParams): string | Promise<string>;
}

export interface PlantUmlCoreApi {
  registerGenerator(genKey: string, generator: PlantUmlGenerator, filter: SourceFilter): vscode.Disposable;
}
