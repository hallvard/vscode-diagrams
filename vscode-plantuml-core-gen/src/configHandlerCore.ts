type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

export type ConfigFilenamesProvider<T> = () => T[] | Promise<T[]>;
export type ConfigReader<T> = (configFilename: T) => Promise<string | undefined> | string | undefined;

export async function readMergedFlattenedGeneratorConfig<T>(
  configFilenamesProvider: ConfigFilenamesProvider<T>,
  configReader: ConfigReader<T>
): Promise<Map<string, string>> {
  const mergedEntries = new Map<string, string>();
  const configFilenames = await configFilenamesProvider();

  for (const configFilename of configFilenames) {
    const configText = await configReader(configFilename);
    if (configText) {
      let config: JsonLike;
      try {
        config = JSON.parse(configText) as JsonLike;
      } catch {
        continue;
      }

      const flattenedEntries = flattenJsonLeaves(config);
      for (const [key, value] of flattenedEntries) {
        if (value === null) {
          mergedEntries.delete(key);
        } else {
          mergedEntries.set(key, value);
        }
      }
    }
  }

  return mergedEntries;
}

function flattenJsonLeaves(value: JsonLike, keyPrefix = ""): Array<[string, string | null]> {
  if (isLeaf(value)) {
    return keyPrefix ? [[keyPrefix, value === null ? null : String(value)]] : [];
  }

  if (Array.isArray(value)) {
    const leaves: Array<[string, string | null]> = [];
    for (let i = 0; i < value.length; i += 1) {
      const nextKey = keyPrefix ? `${keyPrefix}.${i}` : String(i);
      leaves.push(...flattenJsonLeaves(value[i], nextKey));
    }
    return leaves;
  }

  const leaves: Array<[string, string | null]> = [];
  for (const [key, child] of Object.entries(value)) {
    const nextKey = keyPrefix ? `${keyPrefix}.${key}` : key;
    leaves.push(...flattenJsonLeaves(child, nextKey));
  }
  return leaves;
}

function isLeaf(value: JsonLike): value is null | boolean | number | string {
  return value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}