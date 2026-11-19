// Procedural SVG generator for the Khargûl script, v0.2.0 "Thornscript".
// Implements EXACTLY the constructionPrinciples documented in
// data/orthography/alphabet.json (spine + thorn geometry), driven by the
// place/manner/voicing fields of data/phonology/phonology.json. No glyph
// shape in this file is hand-authored per letter: every visual feature is
// derived from a phonological property. See DESIGN_DECISIONS.md D3/D12.
//
// This replaces the v0.1.0 stem+attached-stroke geometry (dots/lines for
// vowels, plain cross-strokes for manner) with the chosen Thornscript
// design: a vertical spine with diagonal "thorns" branching off it at an
// angle/zone/pattern set by place, manner, voicing and vowel quality, drawn
// (conceptually) as one continuous pen stroke per alphabet.json's
// `handwriting` section.
import type { PhonemeToken } from "./phonemes.js";
import type { Syllable } from "./syllabify.js";

// alphabet.json constructionPrinciples.baseShape: "60x100 unit cell".
const CELL_W = 60;
const CELL_H = 100;
const SPINE_X = 30;
const SPINE_TOP = 10;
const SPINE_BOTTOM = 90;
const THORN_LEN = 13;

// placeOfArticulationRule: three zones along the spine.
const ZONE_Y: Record<"upper" | "middle" | "lower", number> = { upper: 21.5, middle: 47.5, lower: 67.5 };

function zoneForPlace(place: string): "upper" | "middle" | "lower" {
  if (place === "bilabial" || place === "labial-velar" || place === "labiodental") return "upper";
  if (place === "alveolar" || place === "postalveolar" || place === "palatal" || place === "dental") return "middle";
  return "lower"; // velar, uvular, glottal
}

function zoneCenterY(place: string): number {
  return ZONE_Y[zoneForPlace(place)];
}

/** A single thorn: a straight line from (spineX, y) out to an angled tip. angleDeg is measured from horizontal, positive = upward. direction -1 = left, +1 = right. */
function thorn(spineX: number, y: number, angleDeg: number, direction: 1 | -1, len: number = THORN_LEN): { tipX: number; tipY: number; path: string } {
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = spineX + direction * len * Math.cos(rad);
  const tipY = y - len * Math.sin(rad);
  return { tipX, tipY, path: `<line x1="${spineX}" y1="${y}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />` };
}

/** Voicing tick: a short perpendicular stroke crossing the outer third of a thorn (mannerOfArticulationRule.voicingRule). */
function voicingTick(spineX: number, y: number, angleDeg: number, direction: 1 | -1, len: number = THORN_LEN): string {
  const rad = (angleDeg * Math.PI) / 180;
  const outerT = 0.72; // outer third of the thorn, measured from the spine
  const px = spineX + direction * outerT * len * Math.cos(rad);
  const py = y - outerT * len * Math.sin(rad);
  const perpRad = rad + Math.PI / 2;
  const half = 3.5;
  const x1 = px + half * Math.cos(perpRad);
  const y1 = py - half * Math.sin(perpRad);
  const x2 = px - half * Math.cos(perpRad);
  const y2 = py + half * Math.sin(perpRad);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="1.6" />`;
}

/** mannerOfArticulationRule: the thorn pattern at a given zone. Returns the SVG for the thorn(s) plus, if voiced, the voicing tick on the primary (first) thorn. */
function strokesForManner(manner: string, y: number, spineX: number, voicing: string): string {
  const voiced = voicing === "voiced";
  switch (manner) {
    case "plosive": {
      const t = thorn(spineX, y, 45, 1);
      return t.path + (voiced ? voicingTick(spineX, y, 45, 1) : "");
    }
    case "fricative": {
      const t = thorn(spineX, y, 45, -1);
      return t.path + (voiced ? voicingTick(spineX, y, 45, -1) : "");
    }
    case "nasal": {
      const right = thorn(spineX, y, 45, 1);
      const left = thorn(spineX, y, 45, -1);
      return right.path + left.path + (voiced ? voicingTick(spineX, y, 45, 1) : "");
    }
    case "trill": {
      const upper = thorn(spineX, y - 6, 45, 1);
      const lower = thorn(spineX, y + 6, 45, 1);
      return upper.path + lower.path + (voiced ? voicingTick(spineX, y - 6, 45, 1) : "");
    }
    case "lateral": {
      // shallow-angled thorn to the left near the base of the spine.
      const t = thorn(spineX, SPINE_BOTTOM - 4, 18, -1);
      return t.path + (voiced ? voicingTick(spineX, SPINE_BOTTOM - 4, 18, -1) : "");
    }
    case "approximant": {
      // two short thorns meeting at a point to the right (shallow "V" opening away from the spine)
      const upper = thorn(spineX, y - 5, 20, 1, THORN_LEN * 0.8);
      const lower = thorn(spineX, y + 5, -20, 1, THORN_LEN * 0.8);
      return upper.path + lower.path + (voiced ? voicingTick(spineX, y - 5, 20, 1, THORN_LEN * 0.8) : "");
    }
    default:
      return "";
  }
}

function spinePath(x: number = SPINE_X, top = SPINE_TOP, bottom = SPINE_BOTTOM, thin = false): string {
  return `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="currentColor" stroke-width="${thin ? 2 : 3}" stroke-linecap="round" />`;
}

// vowelRule: angle around the top of the spine, clockwise from vertical.
// i = 0° (straight up), e = 30° upper-right, a = 60° upper-right,
// o = -30° upper-left, u = -60° upper-left. Long vowels double the thorn.
const VOWEL_ANGLE: Record<string, number> = { i: 0, e: 30, a: 60, o: -30, u: -60 };

function baseVowelId(id: string): string {
  return id.replace(/[âêîôû]/g, (ch) => ({ â: "a", ê: "e", î: "i", ô: "o", û: "u" }[ch] ?? ch));
}

/** One vowel thorn (or doubled, for a long vowel) anchored above the spine top, per vowelRule. `heightOffset` lifts stacked diphthong components. */
function vowelThorn(token: { id: string; isLong?: boolean }, spineX: number, heightOffset = 0): string {
  const base = baseVowelId(token.id);
  const angleFromVertical = VOWEL_ANGLE[base] ?? 0;
  // Convert "clockwise from vertical" to our horizontal-based angle convention:
  // vertical (straight up) = 90° in our thorn() convention; clockwise rotation
  // (toward the right for positive e/a, toward the left for negative o/u)
  // subtracts from 90.
  const angleDeg = 90 - angleFromVertical;
  const direction: 1 | -1 = angleFromVertical >= 0 ? 1 : -1;
  const y = SPINE_TOP - heightOffset;
  const len = THORN_LEN * 0.8;
  const first = thorn(spineX, y, angleDeg, direction, len);
  if (!token.isLong) return first.path;
  // Long vowel: a second, parallel thorn close to the first (doubled stroke).
  const rad = (angleDeg * Math.PI) / 180;
  const nx = direction * Math.sin(rad) * -1; // small perpendicular offset
  const ny = Math.cos(rad) * -1;
  const offset = 3;
  const x1 = spineX + nx * offset;
  const y1 = y + ny * offset;
  const second = thorn(x1, y1, angleDeg, direction, len);
  return first.path + second.path;
}

/** diphthongRule: two vowel-angle thorns stacked at two heights, bottom-to-top in pronunciation order. */
const DIPHTHONG_COMPONENTS: Record<string, [string, string]> = {
  ai: ["a", "i"],
  au: ["a", "u"],
  oi: ["o", "i"],
};

function renderVowel(token: PhonemeToken, spineX: number): string {
  if (token.isDiphthong) {
    const comps = DIPHTHONG_COMPONENTS[token.id];
    if (!comps) return vowelThorn(token, spineX);
    const lower = vowelThorn({ id: comps[0] }, spineX, 0);
    const upper = vowelThorn({ id: comps[1] }, spineX, 11);
    return lower + upper;
  }
  return vowelThorn(token, spineX);
}

function svgWrap(inner: string, width: number, height: number = CELL_H): string {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="khargul-glyph">${inner}</svg>`;
}

/** Renders a single consonant letter in isolation (used by the alphabet chart). */
export function generateConsonantGlyph(consonant: { place: string; manner: string; voicing: string }): string {
  const y = zoneCenterY(consonant.place);
  const inner = spinePath() + strokesForManner(consonant.manner, y, SPINE_X, consonant.voicing);
  return svgWrap(inner, CELL_W);
}

/** Renders a single vowel letter in isolation on the neutral short carrier spine (word-initial vowelRule). */
export function generateVowelGlyph(vowel: { id: string; isLong?: boolean; isDiphthong?: boolean }): string {
  const inner = spinePath(SPINE_X, SPINE_TOP, SPINE_BOTTOM, true) + renderVowel(vowel as PhonemeToken, SPINE_X);
  return svgWrap(inner, CELL_W);
}

/**
 * Renders a full syllable block: a spine carrying the onset consonant
 * thorn(s) partway down and the nucleus vowel thorn(s) at the top (or a
 * neutral short carrier spine if the syllable is vowel-initial), followed by
 * a second spine per coda consonant, per alphabet.json's syllableBlocking
 * ("a consonant plus its following vowel form a single visual block").
 */
export function generateSyllableGlyph(syllable: Syllable): string {
  const subCells: string[] = [];
  const consonants = [...syllable.onset];

  if (consonants.length === 0) {
    subCells.push(spinePath(SPINE_X, SPINE_TOP, SPINE_BOTTOM, true) + renderVowel(syllable.nucleus, SPINE_X));
  } else {
    consonants.forEach((c, i) => {
      const y = zoneCenterY(c.place ?? "alveolar");
      let cell = spinePath() + strokesForManner(c.manner ?? "plosive", y, SPINE_X, c.voicing ?? "voiceless");
      if (i === consonants.length - 1) {
        cell += renderVowel(syllable.nucleus, SPINE_X);
      }
      subCells.push(cell);
    });
  }

  for (const c of syllable.coda) {
    const y = zoneCenterY(c.place ?? "alveolar");
    subCells.push(spinePath() + strokesForManner(c.manner ?? "plosive", y, SPINE_X, c.voicing ?? "voiceless"));
  }

  const groups = subCells.map((cell, i) => `<g transform="translate(${i * CELL_W}, 0)">${cell}</g>`).join("");
  return svgWrap(groups, CELL_W * subCells.length);
}

/** Lays out a full word as a left-to-right run of syllable blocks. Caller inserts word-boundary separators between words, not within. */
export function generateWordGlyph(syllables: Syllable[]): string {
  const blocks = syllables.map((s) => stripSvgWrapper(generateSyllableGlyph(s)));
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

function stripSvgWrapper(svg: string): string {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return match ? match[1] : svg;
}

// --- Numerals (alphabet.json "numerals" section) -----------------------
// base-10, built from the same spine+thorn system: 0 = bare spine, 1 = one
// thorn, 2 = two thorns, ... 9 = spine fully crossed. Thorns are added
// alternating right/left, descending the spine, so the count is visually
// unambiguous at a glance.
export function generateNumeralGlyph(digit: number): string {
  const d = Math.max(0, Math.min(9, Math.floor(digit)));
  let inner = spinePath();
  const positions = [25, 35, 45, 55, 65, 75, 30, 50, 70];
  for (let i = 0; i < d; i++) {
    const y = positions[i] ?? 25 + i * 7;
    const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
    inner += thorn(SPINE_X, y, 45, direction, THORN_LEN * 0.7).path;
  }
  return svgWrap(inner, CELL_W);
}

// --- Punctuation (alphabet.json "punctuation"/"wordSeparation") --------
// A vertical tick taller than the x-height; doubled/tripled for
// clause-pause/sentence-end, hooked for a yes/no question.
export function generatePunctuationGlyph(kind: "wordBoundary" | "clausePause" | "sentenceEnd" | "question"): string {
  const tickX = (i: number) => 10 + i * 8;
  const tick = (x: number, hook = false) =>
    hook
      ? `<path d="M ${x} 20 L ${x} 70 Q ${x + 8} 78 ${x + 2} 86" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />`
      : `<line x1="${x}" y1="20" x2="${x}" y2="80" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`;
  if (kind === "wordBoundary") return svgWrap(tick(20), 40);
  if (kind === "clausePause") return svgWrap(tick(16) + tick(24), 40);
  if (kind === "sentenceEnd") return svgWrap(tick(12) + tick(20) + tick(28), 44);
  return svgWrap(tick(20, true), 40); // question hook
}
