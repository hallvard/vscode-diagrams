# PlantUML Java Class Generator

This companion extension registers a Java class diagram generator into `local.vscode-plantuml-core-gen`.

Registered key:

- `java2class` for `.java`

This first version is intentionally minimal:

- Uses VS Code's `executeDocumentSymbolProvider` on one source file
- Emits class/interface/enum type blocks from the symbol tree
- Includes fields and methods for those types
- Does not yet include inheritance or associations
