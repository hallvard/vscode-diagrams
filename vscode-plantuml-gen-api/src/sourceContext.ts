import * as path from "node:path";
import * as vscode from "vscode";

import { SourceFilter } from "./sourceFilter";

export class SourceContext {
  private textDocumentPromise?: Promise<vscode.TextDocument>;
  private textPromise?: Promise<string>;
  private readonly prefixCache = new Map<number, Promise<string>>();

  public constructor(private readonly sourceUri: vscode.Uri) {}

  public getUri(): vscode.Uri {
    return this.sourceUri;
  }

  public getTextDocument(): Promise<vscode.TextDocument> {
    if (!this.textDocumentPromise) {
      const openDocument = this.findOpenDocument();
      this.textDocumentPromise = openDocument
        ? Promise.resolve(openDocument)
        : Promise.resolve(vscode.workspace.openTextDocument(this.sourceUri));
    }

    return this.textDocumentPromise;
  }

  public getText(): Promise<string> {
    if (!this.textPromise) {
      const openDocument = this.findOpenDocument();
      if (openDocument) {
        this.textDocumentPromise = Promise.resolve(openDocument);
        this.textPromise = Promise.resolve(openDocument.getText());
      } else if (this.textDocumentPromise) {
        this.textPromise = this.textDocumentPromise.then((document) => document.getText());
      } else {
        this.textPromise = Promise.resolve(vscode.workspace.fs.readFile(this.sourceUri))
          .then((bytes) => Buffer.from(bytes).toString("utf8"));
      }
    }

    return this.textPromise;
  }

  public getPrefix(characterCount: number): Promise<string> {
    const normalizedCharacterCount = Math.max(0, Math.trunc(characterCount));
    const cachedPrefix = this.prefixCache.get(normalizedCharacterCount);
    if (cachedPrefix) {
      return cachedPrefix;
    }

    const prefixPromise = this.getText().then((text) => text.slice(0, normalizedCharacterCount));
    this.prefixCache.set(normalizedCharacterCount, prefixPromise);
    return prefixPromise;
  }

  public async satisfiesFilter(filter: SourceFilter): Promise<boolean> {
    if (filter.scheme && filter.scheme !== this.sourceUri.scheme) {
      return false;
    }

    if (filter.fileExtension && !this.satisfiesFileExtension(filter.fileExtension)) {
      return false;
    }

    if (filter.pattern || filter.language) {
      const document = await this.getTextDocument();
      return vscode.languages.match(filter, document) > 0;
    }
    
    return true;
  }

  private findOpenDocument(): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((document) => document.uri.toString() === this.sourceUri.toString());
  }

  private satisfiesFileExtension(fileExtension: string | readonly string[]): boolean {
    const allowedExtensions = Array.isArray(fileExtension) ? fileExtension : [fileExtension];
    const sourceExtension = path.posix.extname(this.sourceUri.path).toLowerCase();
    return allowedExtensions.some((extension) => normalizeFileExtension(extension) === sourceExtension);
  }
}

function normalizeFileExtension(fileExtension: string): string {
  const trimmedExtension = fileExtension.trim().toLowerCase();
  if (!trimmedExtension) {
    return "";
  }

  return trimmedExtension.startsWith(".") ? trimmedExtension : `.${trimmedExtension}`;
}