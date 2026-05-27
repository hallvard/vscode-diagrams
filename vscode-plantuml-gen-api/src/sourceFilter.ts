import * as vscode from "vscode";

export type SourceFilter = vscode.DocumentFilter & {
  fileExtension?: string | readonly string[];
};