// The way back from a coined word.
//
// coiner_v1 is a hash, so "gidu" carries no trace of "spaceship". A coined
// word can therefore only be translated back if someone wrote the pairing
// down. This module is that record: a pre-computed index of the common
// vocabulary (data/lexicon/coinages.json, built by scripts/buildCoinageIndex.ts)
// plus whatever the translator coins while it runs.
//
// The runtime half lives in memory and dies with the process. That is a real
// limit and it is stated rather than hidden: a word nobody has ever coined
// before still comes back bracketed. Making it permanent means writing to
// data/lexicon/coinages.json, which is a job for the proposal flow, not for a
// translator that has to stay pure so it can be compiled to WASM.
import coinagesData from "../../data/lexicon/coinages.json";

export interface CoinageRecord {
  gkh: string;
  lemma: string;
  lang: "en" | "nl";
}

interface CoinageFile {
  version: string;
  note: string;
  entryCount: number;
  entries: CoinageRecord[];
}

const file = coinagesData as CoinageFile;

/** gkh -> every gloss recorded for it, in the order they were learned. */
const index = new Map<string, CoinageRecord[]>();

function put(record: CoinageRecord): void {
  const existing = index.get(record.gkh);
  if (!existing) {
    index.set(record.gkh, [record]);
    return;
  }
  if (existing.some((r) => r.lemma === record.lemma && r.lang === record.lang)) return;
  existing.push(record);
}

for (const record of file.entries) put(record);

const seededCount = index.size;

/** Everything recorded for this spelling: the pre-computed index first, then anything coined since. */
export function lookupCoinage(gkh: string): CoinageRecord[] {
  return index.get(gkh.toLowerCase()) ?? [];
}

/** The gloss to show for a coined word in the requested language, or null when this spelling has never been coined. */
export function glossCoinage(gkh: string, lang: "en" | "nl"): string | null {
  const records = lookupCoinage(gkh);
  return records.find((r) => r.lang === lang)?.lemma ?? records[0]?.lemma ?? null;
}

/** Remembers a coinage for the rest of this process, so a word just coined in one direction reads back in the other. */
export function recordCoinage(record: CoinageRecord): void {
  put({ ...record, gkh: record.gkh.toLowerCase() });
}

/** How many spellings the shipped index knows, before anything was added at runtime. */
export function seededCoinageCount(): number {
  return seededCount;
}
