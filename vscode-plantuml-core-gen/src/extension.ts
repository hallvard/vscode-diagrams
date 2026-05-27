import * as vscode from "vscode";
import { URLSearchParams } from "node:url";

import { PlantUmlCoreApi, PlantUmlGenerator, SourceContext, SourceFilter } from "vscode-plantuml-gen-api";
import { getQueryParamsFromGeneratorConfig } from "./configHandler";
import {
  registerOpenAsVirtualPlantUmlCommand,
} from "./commands/openAsVirtualPlantUmlCommand";

const VIRTUAL_SCHEME = "plantuml-core-gen";
const VIRTUAL_SUFFIX = ".puml";

type VirtualSourceInfo = {
  sourceUri: vscode.Uri;
  transformKey: string;
};

type RegisteredGenerator = {
  filter: SourceFilter;
  generator: PlantUmlGenerator;
};

class PlantUmlVirtualDocumentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  public readonly generators = new Map<string, RegisteredGenerator>();

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

    const registration = this.generators.get(sourceInfo.transformKey);
    if (!registration) {
      return `@startuml\nnote as N\nUnsupported transform: ${sourceInfo.transformKey}\nend note\n@enduml\n`;
    }

    const sourceContext = new SourceContext(sourceInfo.sourceUri);

    if (!(await sourceContext.satisfiesFilter(registration.filter)) || !(await registration.generator.supportsSourceUri(sourceContext))) {
      return `@startuml\nnote as N\nTransform ${sourceInfo.transformKey} does not support source ${sourceInfo.sourceUri.toString()}\nend note\n@enduml\n`;
    }

    const sourceText = await sourceContext.getText();
    const options = new URLSearchParams(virtualUri.query);

    return registration.generator.generate(sourceInfo.sourceUri, sourceText, options);
  }
}

export function activate(context: vscode.ExtensionContext): PlantUmlCoreApi {
  const provider = new PlantUmlVirtualDocumentProvider();
  const api: PlantUmlCoreApi = {
    registerGenerator: (genKey, generator, filter) => registerGenerator(provider.generators, genKey, generator, filter),
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

async function toVirtualPlantUmlUri(sourceUri: vscode.Uri, transformName: string): Promise<vscode.Uri> {
  const cleanTransformName = transformName.replace(/^\/+/, "").replace(/\/+$/, "");
  const virtualPath = `/${cleanTransformName}${sourceUri.path}${VIRTUAL_SUFFIX}`;
  const queryParams = await getQueryParamsFromGeneratorConfig(sourceUri, cleanTransformName);

  return vscode.Uri.from({
    scheme: VIRTUAL_SCHEME,
    authority: sourceUri.authority,
    path: virtualPath,
    query: queryParams.toString(),
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

async function getSupportedTransformKeys(
  transformers: ReadonlyMap<string, RegisteredGenerator>,
  sourceUri: vscode.Uri
): Promise<string[]> {
  const sourceContext = new SourceContext(sourceUri);
  const supportEntries = await Promise.all(
    [...transformers.entries()].map(async ([key, registration]) => ({
      key,
      isSupported:
        (await sourceContext.satisfiesFilter(registration.filter))
        && (await registration.generator.supportsSourceUri(sourceContext)),
    }))
  );

  return supportEntries
    .filter((entry) => entry.isSupported)
    .map((entry) => entry.key)
    .sort((a, b) => a.localeCompare(b));
}

function registerGenerator(
  generators: Map<string, RegisteredGenerator>,
  genKey: string,
  generator: PlantUmlGenerator,
  filter: SourceFilter
): vscode.Disposable {
  generators.set(genKey, { generator, filter });

  return new vscode.Disposable(() => {
    const current = generators.get(genKey);
    if (current?.generator === generator) {
      generators.delete(genKey);
    }
  });
}
