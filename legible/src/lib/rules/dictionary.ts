import { createDictionary, type Dictionary } from "./hashtags";
import { WORDS } from "./dictionary-data";

let cached: Dictionary | null = null;

/** The bundled English dictionary (~43k words). Built once per process. */
export function getDictionary(): Dictionary {
  cached ??= createDictionary(WORDS);
  return cached;
}
