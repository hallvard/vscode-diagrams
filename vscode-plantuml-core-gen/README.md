# PlantUML Core Transform Extension

This extension provides a core command and virtual-document framework for PlantUML generators.

It does not ship built-in generators. Other extensions register generators at runtime.

## Features (v1)

- Command: **PlantUML: Open As Virtual Diagram**
- Input: selected file (Explorer, editor, or open-file picker)
- The command then shows only transformation names that support the selected source file.
- Output: virtual document using a custom URI scheme.

Use a companion extension to register actual transformations.

Example companion extension in this workspace:

- `vscode-plantuml-json-yaml-gen`

The output document is virtual and read-only, so it can be opened by PlantUML tooling without writing a generated file to disk.

## Virtual URI format

The virtual document uses a generator-name first path segment, then the source file path, then `.puml` under the custom scheme:

`plantuml-core-gen:/json2puml/absolute/source/path.json.puml`

Example source file URI:

`file:///Users/me/work/example.json`

Example virtual URI:

`plantuml-core-trans:/json2puml/Users/me/work/example.json.puml`

This keeps query parameters available for future transformation options.

## Extension API

This extension exports an API from `activate()`:

- `registerGenerator(genKey, generator): Disposable`

Where a generator implements:

- `supportsSourceUri(sourceUri): boolean`
- `generate(sourceText, options): string | Promise<string>`

## Development

```bash
npm install
npm run compile
```

Then run the extension using **Run Extension** in VS Code.
