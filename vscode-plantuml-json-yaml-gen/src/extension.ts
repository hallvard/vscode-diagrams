import * as vscode from "vscode";

import { PLANTUML_CORE_EXTENSION_ID, PlantUmlCoreApi } from "vscode-plantuml-gen-api";
import { JsonPlantUmlGenerator } from "./generators/jsonPlantUmlGenerator";
import { YamlPlantUmlGenerator } from "./generators/yamlPlantUmlGenerator";

const JSON_PUML_GENERATOR = "json2puml";
const YAML_PUML_GENERATOR = "yaml2puml";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const coreExtension = vscode.extensions.getExtension<PlantUmlCoreApi>(PLANTUML_CORE_EXTENSION_ID);
  if (coreExtension) {
    const coreApi = await coreExtension.activate();
    context.subscriptions.push(
      coreApi.registerGenerator(JSON_PUML_GENERATOR, new JsonPlantUmlGenerator()),
      coreApi.registerGenerator(YAML_PUML_GENERATOR, new YamlPlantUmlGenerator())
    );
  }
}

export function deactivate(): void {
  // Registrations are disposed through context subscriptions.
}
