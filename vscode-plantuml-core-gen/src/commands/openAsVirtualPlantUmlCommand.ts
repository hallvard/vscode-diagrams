import * as vscode from "vscode";

export const OPEN_AS_VIRTUAL_PUML_COMMAND = "vscodePlantumlCoreGen.openAsVirtualPlantUml";

type OpenAsVirtualPlantUmlDeps = {
  getSupportedGenKeys: (sourceUri: vscode.Uri) => string[] | Promise<string[]>;
  toVirtualPlantUmlUri: (sourceUri: vscode.Uri, genKey: string) => vscode.Uri | Promise<vscode.Uri>;
};

export function registerOpenAsVirtualPlantUmlCommand(deps: OpenAsVirtualPlantUmlDeps): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_AS_VIRTUAL_PUML_COMMAND, async (resource?: vscode.Uri) => {
    const sourceUri = await resolveSourceUri(resource);
    if (!sourceUri) {
      return;
    }

    const supportedGenKeys = await deps.getSupportedGenKeys(sourceUri);
    if (supportedGenKeys.length === 0) {
      void vscode.window.showWarningMessage(`No generator supports ${sourceUri.fsPath}.`);
      return;
    }

    const selectedGenKey = await selectGenKey(supportedGenKeys);
    if (!selectedGenKey) {
      return;
    }

    const virtualUri = await deps.toVirtualPlantUmlUri(sourceUri, selectedGenKey);

    const doc = await vscode.workspace.openTextDocument(virtualUri);
    try {
      await vscode.languages.setTextDocumentLanguage(doc, "plantuml");
    } catch {
      // If language assignment fails, extension-based detection may still work.
    }

    await vscode.window.showTextDocument(doc, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.Beside,
    });
  });
}

async function resolveSourceUri(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (resource && resource.scheme === "file") {
    return resource;
  }

  const editor = vscode.window.activeTextEditor;
  const activeUri = editor?.document.uri;
  if (activeUri?.scheme === "file") {
    return activeUri;
  }

  const picks = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: "Select source file",
  });

  if (!picks || picks.length === 0) {
    return undefined;
  }

  return picks[0];
}

async function selectGenKey(genKeys: string[]): Promise<string | undefined> {
  if (genKeys.length === 1) {
    return genKeys[0];
  }

  const selected = await vscode.window.showQuickPick(genKeys, {
    title: "Select generator",
    placeHolder: "Choose a generator for the selected source file",
    canPickMany: false,
  });

  return selected;
}
