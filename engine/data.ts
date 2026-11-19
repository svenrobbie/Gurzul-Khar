// Single loader for the /data JSON source of truth. Every other engine module
// must import language data through this file rather than re-reading JSON
// directly, so there is exactly one path from disk into the engine.
import phonologyData from "../data/phonology/phonology.json";
import alphabetData from "../data/orthography/alphabet.json";
import grammarData from "../data/morphology/grammar.json";
import lexiconData from "../data/lexicon/lexicon.json";

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

export const phonology = phonologyData as PhonologyData;
export const alphabet = alphabetData as any;
export const grammar = grammarData as any;
export const lexicon = lexiconData as LexiconData;
