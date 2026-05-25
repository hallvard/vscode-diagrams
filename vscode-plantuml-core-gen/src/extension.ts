import * as vscode from "vscode";
import { URLSearchParams } from "node:url";

import { PlantUmlCoreApi, PlantUmlGenerator } from "vscode-plantuml-gen-api";
import {
  registerOpenAsVirtualPlantUmlCommand,
} from "./commands/openAsVirtualPlantUmlCommand";

const VIRTUAL_SCHEME = "plantuml-core-gen";
const VIRTUAL_SUFFIX = ".puml";

type VirtualSourceInfo = {
  sourceUri: vscode.Uri;
  transformKey: string;
};

class PlantUmlVirtualDocumentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  public readonly generators = new Map<string, PlantUmlGenerator>();

  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  public provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    return this.buildContent(uri);
  }

  public refreshForSource(sourceUri: vscode.Uri): void {
    const sourceKey = sourceUri.toString();

    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme !== VIRTUAL_SCHEME) {
        continue;
      }

      const sourceInfo = getSourceInfoFromVirtualUri(document.uri);
      if (sourceInfo && sourceInfo.sourceUri.toString() === sourceKey) {
        this.onDidChangeEmitter.fire(document.uri);
      }
    }
  }

  public dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  private async buildContent(virtualUri: vscode.Uri): Promise<string> {
    const sourceInfo = getSourceInfoFromVirtualUri(virtualUri);
    if (!sourceInfo) {
      return "@startuml\nnote as N\nInvalid virtual URI path; expected /{transform}/{sourcePath}.puml.\nend note\n@enduml\n";
    }

    const generator = this.generators.get(sourceInfo.transformKey);
    if (!generator) {
      return `@startuml\nnote as N\nUnsupported transform: ${sourceInfo.transformKey}\nend note\n@enduml\n`;
    }

    if (!generator.supportsSourceUri(sourceInfo.sourceUri)) {
      return `@startuml\nnote as N\nTransform ${sourceInfo.transformKey} does not support source ${sourceInfo.sourceUri.toString()}\nend note\n@enduml\n`;
    }

    const sourceText = await getSourceText(sourceInfo.sourceUri);
    const options = new URLSearchParams(virtualUri.query);

    return generator.generate(sourceInfo.sourceUri, sourceText, options);
  }
}

export function activate(context: vscode.ExtensionContext): PlantUmlCoreApi {
  const provider = new PlantUmlVirtualDocumentProvider();
  const api: PlantUmlCoreApi = {
    registerGenerator: (genKey, generator) => registerGenerator(provider.generators, genKey, generator),
  };

  context.subscriptions.push(
    provider,
    vscode.workspace.registerTextDocumentContentProvider(VIRTUAL_SCHEME, provider),
    vscode.workspace.onDidChangeTextDocument((event) => provider.refreshForSource(event.document.uri)),
    vscode.workspace.onDidSaveTextDocument((document) => provider.refreshForSource(document.uri)),
    registerOpenAsVirtualPlantUmlCommand({
      getSupportedGenKeys: (sourceUri) => getSupportedTransformKeys(provider.generators, sourceUri),
      toVirtualPlantUmlUri,
    })
  );

  return api;
}

export function deactivate(): void {
  // Nothing to clean up explicitly; disposables are tracked in context.subscriptions.
}

function toVirtualPlantUmlUri(sourceUri: vscode.Uri, transformName: string): vscode.Uri {
  const cleanTransformName = transformName.replace(/^\/+/, "").replace(/\/+$/, "");
  const virtualPath = `/${cleanTransformName}${sourceUri.path}${VIRTUAL_SUFFIX}`;

  return vscode.Uri.from({
    scheme: VIRTUAL_SCHEME,
    authority: sourceUri.authority,
    path: virtualPath,
  });
}

function getSourceInfoFromVirtualUri(virtualUri: vscode.Uri): VirtualSourceInfo | undefined {
  if (!virtualUri.path.endsWith(VIRTUAL_SUFFIX)) {
    return undefined;
  }

  const withoutSuffix = virtualUri.path.slice(0, -VIRTUAL_SUFFIX.length);
  const segments = withoutSuffix.split("/").filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }

  const transformKey = segments[0];
  const sourceRelativePath = segments.slice(1).join("/");
  const sourcePath = `/${sourceRelativePath}`;
  const sourceUri = vscode.Uri.from({
    scheme: "file",
    authority: virtualUri.authority,
    path: sourcePath,
  });

  return {
    sourceUri,
    transformKey,
  };
}

async function getSourceText(sourceUri: vscode.Uri): Promise<string> {
  const openDoc = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === sourceUri.toString());
  if (openDoc) {
    return openDoc.getText();
  }

  const bytes = await vscode.workspace.fs.readFile(sourceUri);
  return Buffer.from(bytes).toString("utf8");
}

function getSupportedTransformKeys(
  transformers: ReadonlyMap<string, PlantUmlGenerator>,
  sourceUri: vscode.Uri
): string[] {
  return [...transformers.entries()]
    .filter(([, transformer]) => transformer.supportsSourceUri(sourceUri))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
}

function registerGenerator(
  generators: Map<string, PlantUmlGenerator>,
  genKey: string,
  generator: PlantUmlGenerator
): vscode.Disposable {
  const normalizedKey = genKey.trim();
  if (!normalizedKey) {
    throw new Error("genKey must be non-empty.");
  }

  if (generators.has(normalizedKey)) {
    throw new Error(`Generator key '${normalizedKey}' is already registered.`);
  }

  generators.set(normalizedKey, generator);

  return new vscode.Disposable(() => {
    const current = generators.get(normalizedKey);
    if (current === generator) {
      generators.delete(normalizedKey);
    }
  });
}
