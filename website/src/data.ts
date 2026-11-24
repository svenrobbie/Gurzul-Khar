// Typed access to the /data JSON source of truth, for the pages that display
// it — the dictionary, the grammar reference, the alphabet chart. This is data
// and the types describing its shape, nothing else: no rule about Gurzûl Khar
// is implemented here. Every such rule lives in crates/gkh-core and reaches
// this site through the WebAssembly engine, so there is one implementation of
// the language and one copy of the data behind it.
import phonologyData from "@data/phonology/phonology.json";
import alphabetData from "@data/orthography/alphabet.json";
import grammarData from "@data/morphology/grammar.json";
import lexiconData from "@data/lexicon/lexicon.json";
import proposalsData from "@data/lexicon/proposals.json";
import coinerWeightsV1Data from "@data/phonology/coinerWeights_v1.json";
import coinerReservedV1Data from "@data/lexicon/coinerReserved_v1.json";

export interface ConsonantDef {
  id: string;
  ipa: string;
  latin: string;
  place: string;
  manner: string;
  voicing: "voiced" | "voiceless";
  positions: string[];
  example: string;
}

export interface VowelDef {
  id: string;
  ipa: string;
  latin: string;
  shortCounterpart?: string;
  example?: string;
}

export interface PhonologyData {
  language: string;
  version: string;
  consonants: ConsonantDef[];
  vowels: {
    short: VowelDef[];
    long: VowelDef[];
    diphthongs: VowelDef[];
  };
  phonotactics: {
    syllableTemplate: string;
    onsetClusters: { allowed: string[]; note: string };
    codaClusters: { allowed: string[]; note: string };
    wordInitialRestrictions: string[];
    wordFinalRestrictions: string[];
    loanwordAdaptation: string[];
  };
  stress: {
    defaultRule: string;
    exceptions: string[];
    sentenceStress: string;
    questionIntonation: string;
    commandIntonation: string;
    emphasis: string;
  };
  designNotes: string;
}

export interface LexiconEntry {
  id: string;
  gkh: string;
  ipa: string;
  pos: string;
  en: string;
  nl: string;
  domain: string;
  root?: string;
  notes?: string;
}

export interface LexiconData {
  language: string;
  version: string;
  note: string;
  derivationalAffixes: { suffix: string; function: string; example: string }[];
  entries: LexiconEntry[];
}

/** Vocabulary lifecycle states — see DESIGN_DECISIONS.md D13 and BACKLOG.md §2.
 * "official" entries live only in lexicon.json; "unknown" is never stored, it
 * is just what the translator reports when nothing matches either file. */
export type VocabStatus = "proposed" | "deprecated" | "rejected";

export interface ProposalEntry extends Omit<LexiconEntry, "id"> {
  id: string;
  status: VocabStatus;
  origin: "manual" | "suggested";
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  /** For a deprecated entry, the lexicon.json id it was moved out of. */
  originalLexiconId?: string;
}

export interface ProposalsData {
  language: string;
  version: string;
  note: string;
  proposals: ProposalEntry[];
}

export const phonology = phonologyData as PhonologyData;
export const alphabet = alphabetData as any;
export const grammar = grammarData as any;
export const lexicon = lexiconData as LexiconData;
export const proposals = proposalsData as ProposalsData;

/** Frequency tables measured from the hand-authored lexicon, frozen with coiner_v1. See scripts/buildCoinerWeights.ts. */
export interface WeightedUnit {
  unit: string;
  weight: number;
}

export interface CoinerWeights {
  version: string;
  note: string;
  measuredFrom: { entries: number; lexiconVersion: string };
  syllableCount: { onePercent: number; twoPercent: number };
  presence: {
    onsetFirstPercent: number;
    onsetMedialPercent: number;
    codaFinalPercent: number;
    codaMedialPercent: number;
    longVowelPercent: number;
  };
  onsetInitial: WeightedUnit[];
  onsetMedial: WeightedUnit[];
  nuclei: WeightedUnit[];
  codaFinal: WeightedUnit[];
  codaMedial: WeightedUnit[];
}

export const coinerWeightsV1 = coinerWeightsV1Data as CoinerWeights;

/** Hand-authored spellings as they stood when coiner_v1 was frozen. See the file's own note for why the coiner reads this instead of the live lexicon. */
export interface CoinerReserved {
  version: string;
  note: string;
  frozenAt: string;
  entryCount: number;
  forms: string[];
}

export const coinerReservedV1 = coinerReservedV1Data as CoinerReserved;
