import * as vscode from "vscode";

import { PLANTUML_CORE_EXTENSION_ID, PlantUmlCoreApi } from "vscode-plantuml-gen-api";
import { JavaClassPlantUmlGenerator } from "./generators/javaClassPlantUmlGenerator";

const JAVA_CLASS_PUML_GENERATOR = "java2class";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const coreExtension = vscode.extensions.getExtension<PlantUmlCoreApi>(PLANTUML_CORE_EXTENSION_ID);
  if (coreExtension) {
    const coreApi = await coreExtension.activate();
    context.subscriptions.push(
      coreApi.registerGenerator(JAVA_CLASS_PUML_GENERATOR, new JavaClassPlantUmlGenerator(), {
        scheme: "file",
        fileExtension: ".java",
      })
    );
  }
}

export function deactivate(): void {
  // Registrations are disposed through context subscriptions.
}
