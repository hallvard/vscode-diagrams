# PlantUML SQL ER Generator

This companion extension registers an SQL generator into `local.vscode-plantuml-core-gen`.

Registered key:

- `sql2er` for `.sql`

The generator parses common `CREATE TABLE` statements and emits a PlantUML ER diagram with entities and FK relationships.

## Supported SQL patterns

- `CREATE TABLE ... (...)` statements
- Inline and table-level `PRIMARY KEY`
- Table-level `FOREIGN KEY (...) REFERENCES ... (...)`
- Inline `REFERENCES` on columns
- Schema-qualified names like `public.users`
- Quoted identifiers using `"name"`, `` `name` ``, or `[name]`
