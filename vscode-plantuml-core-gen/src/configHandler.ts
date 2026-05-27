import { URLSearchParams } from "node:url";
import * as vscode from "vscode";

import { readMergedFlattenedGeneratorConfig } from "./configHandlerCore";

export async function getQueryParamsFromGeneratorConfig(sourceUri: vscode.Uri, genKey: string): Promise<URLSearchParams> {
  const mergedEntries = await readMergedFlattenedGeneratorConfig(
    () => getConfigFilenamesFromWorkspaceRoot(sourceUri, genKey),
    readConfigText
  );
  const params = new URLSearchParams();
  for (const [key, value] of mergedEntries) {
    params.append(key, value);
  }

  return params;
}

function getConfigFilenamesFromWorkspaceRoot(sourceUri: vscode.Uri, genKey: string): string[] {
  const sourceDirectoryPath = sourceUri.path.replace(/\/[^/]*$/, "") || "/";
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri);
  if (!workspaceFolder || workspaceFolder.uri.scheme !== sourceUri.scheme) {
    return [vscode.Uri.joinPath(sourceUri.with({ path: sourceDirectoryPath }), `${genKey}.json`).fsPath];
  }

  const workspaceRootPath = workspaceFolder.uri.path.replace(/\/+$/, "") || "/";
  const sourceDirectoryUri = sourceUri.with({ path: sourceDirectoryPath });
  const filenames: string[] = [];

  let currentPath = sourceDirectoryUri.path;
  while (true) {
    filenames.push(vscode.Uri.joinPath(sourceUri.with({ path: currentPath }), `${genKey}.json`).fsPath);
    if (currentPath === workspaceRootPath) {
      break;
    }

    if (!currentPath.startsWith(`${workspaceRootPath}/`)) {
      return [sourceDirectoryUri.fsPath];
    }

    const parentPath = currentPath.replace(/\/[^/]*$/, "") || "/";
    if (parentPath === currentPath) {
      return [sourceDirectoryUri.fsPath];
    }

    currentPath = parentPath;
  }

  return filenames.reverse();
}

async function readConfigText(configFilename: string): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(configFilename));
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return undefined;
  }
}