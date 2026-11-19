// Procedural SVG generator for the Khargûl script, implementing EXACTLY the
// constructionPrinciples documented in data/orthography/alphabet.json, driven
// by the place/manner/voicing fields of data/phonology/phonology.json.
// No glyph shape in this file is hand-authored per letter: every visual
// feature is derived from a phonological property. See DESIGN_DECISIONS.md D3.
import type { PhonemeToken } from "./phonemes.js";
import type { Syllable } from "./syllabify.js";

const CELL_W = 40;
const CELL_H = 100;
const STEM_X = 20;
const STEM_TOP = 10;
const STEM_BOTTOM = 90;

// alphabet.json placeOfArticulationRule: top/middle/bottom third of the stem.
const ZONE_Y: Record<string, [number, number]> = {
  top: [STEM_TOP, STEM_TOP + (STEM_BOTTOM - STEM_TOP) / 3],
  middle: [STEM_TOP + (STEM_BOTTOM - STEM_TOP) / 3, STEM_TOP + (2 * (STEM_BOTTOM - STEM_TOP)) / 3],
  bottom: [STEM_TOP + (2 * (STEM_BOTTOM - STEM_TOP)) / 3, STEM_BOTTOM],
};

function zoneForPlace(place: string): "top" | "middle" | "bottom" {
  if (place === "bilabial" || place === "labial-velar" || place === "labiodental") return "top";
  if (place === "alveolar" || place === "postalveolar" || place === "palatal" || place === "dental") return "middle";
  // velar, uvular, glottal
  return "bottom";
}

function zoneCenterY(place: string): number {
  const [y0, y1] = ZONE_Y[zoneForPlace(place)];
  return (y0 + y1) / 2;
}

// alphabet.json mannerOfArticulationRule.
function strokeForManner(manner: string, cy: number, stemX: number): string {
  const left = stemX - 12;
  const right = stemX - 2;
  switch (manner) {
    case "plosive":
      // solid straight bar
      return `<line x1="${left}" y1="${cy}" x2="${right}" y2="${cy}" stroke="currentColor" stroke-width="3" />`;
    case "fricative": {
      // wavy / zig-zag bar
      const midY1 = cy - 4;
      const midY2 = cy + 4;
      return `<path d="M ${left} ${cy} L ${left + 3.5} ${midY1} L ${left + 7} ${midY2} L ${left + 10.5} ${midY1} L ${right} ${cy}" stroke="currentColor" stroke-width="2.5" fill="none" />`;
    }
    case "nasal":
      // closed loop
      return `<ellipse cx="${(left + right) / 2}" cy="${cy}" rx="6" ry="5" stroke="currentColor" stroke-width="2.5" fill="none" />`;
    case "trill":
    case "lateral":
      // diagonal cross-stroke through the stem
      return `<line x1="${left}" y1="${cy - 6}" x2="${right + 4}" y2="${cy + 6}" stroke="currentColor" stroke-width="2.5" />`;
    case "approximant":
      // short open hook
      return `<path d="M ${left} ${cy + 5} Q ${left} ${cy - 6} ${right} ${cy - 4}" stroke="currentColor" stroke-width="2.5" fill="none" />`;
    default:
      return "";
  }
}

// alphabet.json voicingRule: filled dot to the right of the stem at stroke height.
function voicingDot(voicing: string, cy: number, stemX: number): string {
  if (voicing !== "voiced") return "";
  return `<circle cx="${stemX + 6}" cy="${cy}" r="2.2" fill="currentColor" />`;
}

function stem(x: number = STEM_X, thin = false): string {
  return `<line x1="${x}" y1="${STEM_TOP}" x2="${x}" y2="${STEM_BOTTOM}" stroke="currentColor" stroke-width="${thin ? 1.5 : 3}" />`;
}

// alphabet.json vowelRule: horizontal offset per vowel quality, relative to
// the stem's quality-to-offset mapping a=0, e=-1, i=-2, o=+1, u=+2 "steps".
const VOWEL_STEP: Record<string, number> = { a: 0, e: -1, i: -2, o: 1, u: 2 };
const STEP_UNIT = 6;

function vowelOffsetX(vowelId: string, stemX: number): number {
  const base = vowelId.replace(/[âêîôû]/g, (ch) => ({ â: "a", ê: "e", î: "i", ô: "o", û: "u" }[ch] ?? ch));
  const step = VOWEL_STEP[base] ?? 0;
  return stemX + step * STEP_UNIT;
}

function vowelDiacritic(token: PhonemeToken, stemX: number, stackIndex = 0): string {
  const y = STEM_TOP - 6 - stackIndex * 10;
  const x = vowelOffsetX(token.id, stemX);
  if (token.isLong) {
    // short horizontal line above the stem
    return `<line x1="${x - 4}" y1="${y}" x2="${x + 4}" y2="${y}" stroke="currentColor" stroke-width="2.5" />`;
  }
  // short vowel: dot above the stem
  return `<circle cx="${x}" cy="${y}" r="2" fill="currentColor" />`;
}

/** Diphthongs combine two stacked vowel diacritics for their component vowels, per alphabet.json diphthongRule. */
const DIPHTHONG_COMPONENTS: Record<string, [string, string]> = {
  ai: ["a", "i"],
  au: ["a", "u"],
  oi: ["o", "i"],
};

function diphthongDiacritics(token: PhonemeToken, stemX: number): string {
  const comps = DIPHTHONG_COMPONENTS[token.id];
  if (!comps) return vowelDiacritic(token, stemX);
  // bottom-to-top in pronunciation order: comps[0] is pronounced first -> lower.
  const lower = vowelDiacritic({ ...token, id: comps[0], isLong: false } as PhonemeToken, stemX, 0);
  const upper = vowelDiacritic({ ...token, id: comps[1], isLong: false } as PhonemeToken, stemX, 1);
  return lower + upper;
}

function renderVowel(token: PhonemeToken, stemX: number): string {
  return token.isDiphthong ? diphthongDiacritics(token, stemX) : vowelDiacritic(token, stemX);
}

function svgWrap(inner: string, width: number): string {
  return `<svg viewBox="0 0 ${width} ${CELL_H}" xmlns="http://www.w3.org/2000/svg" class="khargul-glyph">${inner}</svg>`;
}

/** Renders a single consonant letter in isolation (used by the alphabet chart). */
export function generateConsonantGlyph(consonant: { place: string; manner: string; voicing: string }): string {
  const cy = zoneCenterY(consonant.place);
  const inner = stem() + strokeForManner(consonant.manner, cy, STEM_X) + voicingDot(consonant.voicing, cy, STEM_X);
  return svgWrap(inner, CELL_W);
}

/** Renders a single vowel letter in isolation on the neutral "null-stem" carrier. */
export function generateVowelGlyph(vowel: { id: string; isLong?: boolean; isDiphthong?: boolean }): string {
  const inner = stem(STEM_X, true) + renderVowel(vowel as PhonemeToken, STEM_X);
  return svgWrap(inner, CELL_W);
}

/**
 * Renders a full syllable block: onset consonant stem(s) carrying the nucleus
 * vowel diacritic on the last onset consonant (or on a null-stem carrier if
 * the syllable is vowel-initial), followed by coda consonant stem(s).
 * Each consonant in a cluster gets its own narrower sub-cell, laid left to
 * right, per alphabet.json syllableBlocking ("a consonant plus its following
 * vowel form a single visual block").
 */
export function generateSyllableGlyph(syllable: Syllable): string {
  const subCells: string[] = [];
  const consonants = [...syllable.onset];
  const vowelCarrierIndex = consonants.length; // index (in subCells) that receives the vowel diacritic

  if (consonants.length === 0) {
    // vowel-initial: null-stem carrier
    subCells.push(stem(STEM_X, true) + renderVowel(syllable.nucleus, STEM_X));
  } else {
    consonants.forEach((c, i) => {
      const cy = zoneCenterY(c.place ?? "alveolar");
      let cell = stem() + strokeForManner(c.manner ?? "plosive", cy, STEM_X) + voicingDot(c.voicing ?? "voiceless", cy, STEM_X);
      if (i === consonants.length - 1) {
        cell += renderVowel(syllable.nucleus, STEM_X);
      }
      subCells.push(cell);
    });
  }

  for (const c of syllable.coda) {
    const cy = zoneCenterY(c.place ?? "alveolar");
    subCells.push(stem() + strokeForManner(c.manner ?? "plosive", cy, STEM_X) + voicingDot(c.voicing ?? "voiceless", cy, STEM_X));
  }

  const width = CELL_W * subCells.length;
  const groups = subCells
    .map((cell, i) => `<g transform="translate(${i * CELL_W}, 0)">${cell}</g>`)
    .join("");
  void vowelCarrierIndex;
  return svgWrap(groups, width);
}

/** Lays out a full word as a left-to-right run of syllable blocks separated by the word-boundary punctuation mark for in-sentence display (caller inserts separators between words, not within). */
export function generateWordGlyph(syllables: Syllable[]): string {
  const blocks = syllables.map((s) => stripSvgWrapper(generateSyllableGlyph(s), CELL_W * widthFactor(s)));
  let xOffset = 0;
  const groups: string[] = [];
  for (let i = 0; i < syllables.length; i++) {
    const w = CELL_W * widthFactor(syllables[i]);
    groups.push(`<g transform="translate(${xOffset}, 0)">${blocks[i]}</g>`);
    xOffset += w + 4; // small gap between syllable blocks within a word
  }
  const totalWidth = Math.max(xOffset - 4, CELL_W);
  return svgWrap(groups.join(""), totalWidth);
}

function widthFactor(s: Syllable): number {
  return Math.max(1, s.onset.length + s.coda.length + (s.onset.length === 0 ? 1 : 0));
}

function stripSvgWrapper(svg: string, _fallbackWidth: number): string {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return match ? match[1] : svg;
}
