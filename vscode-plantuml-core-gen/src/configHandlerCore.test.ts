import * as assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { readMergedFlattenedGeneratorConfig } from "./configHandlerCore";

test("readMergedFlattenedGeneratorConfig merges two files in order and drops nulls", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "plantuml-config-handler-"));
  const baseConfigPath = join(tempDirectory, "base.json");
  const overrideConfigPath = join(tempDirectory, "override.json");

  await writeFile(
    baseConfigPath,
    JSON.stringify(
      {
        alpha: "root",
        nested: {
          shared: "root",
          keep: true,
          removed: "base",
        },
        deleteMe: "root",
      },
      undefined,
      2
    ),
    "utf8"
  );

  await writeFile(
    overrideConfigPath,
    JSON.stringify(
      {
        nested: {
          shared: "child",
          removed: null,
        },
        deleteMe: null,
        overrideOnly: 42,
      },
      undefined,
      2
    ),
    "utf8"
  );

  const mergedEntries = await readMergedFlattenedGeneratorConfig(
    () => [baseConfigPath, overrideConfigPath],
    async (configFilePath) => readFile(configFilePath, "utf8")
  );

  assert.deepEqual(Array.from(mergedEntries.entries()), [
    ["alpha", "root"],
    ["nested.shared", "child"],
    ["nested.keep", "true"],
    ["overrideOnly", "42"],
  ]);
});