import * as vscode from "vscode";

import { PLANTUML_CORE_EXTENSION_ID, PlantUmlCoreApi } from "vscode-plantuml-gen-api";
import { SqlErPlantUmlGenerator } from "./generators/sqlErPlantUmlGenerator";

const SQL_ER_PUML_GENERATOR = "sql2er";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const coreExtension = vscode.extensions.getExtension<PlantUmlCoreApi>(PLANTUML_CORE_EXTENSION_ID);
  if (coreExtension) {
    const coreApi = await coreExtension.activate();
    context.subscriptions.push(
      coreApi.registerGenerator(SQL_ER_PUML_GENERATOR, new SqlErPlantUmlGenerator(), {
        scheme: "file",
        fileExtension: ".sql",
      })
    );
  }
}

export function deactivate(): void {
  // Registrations are disposed through context subscriptions.
}
