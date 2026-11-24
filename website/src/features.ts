/**
 * Site feature flags.
 *
 * SHOW_NATIVE_SCRIPT controls whether the Khargûl script is shown anywhere on
 * the site. It is currently OFF: the language is written in the Latin
 * transliteration for now, which is what every page, lesson and example uses.
 *
 * Nothing has been deleted to achieve this. The script's data
 * (data/orthography/alphabet.json), its procedural glyph generator
 * (engine/phonology/glyphGenerator.ts) and the Alphabet page all still exist
 * and still pass their tests — the flag only decides whether the UI surfaces
 * them. Flip this to true and the script, its page and its nav entry come
 * back exactly as they were.
 *
 * Worth knowing before flipping it back: the generator has no glyph for the
 * vowel "ü", so that letter renders as a bare Latin character in the middle of
 * a row of glyphs. That gap is the reason the script looked unfinished.
 */
export const SHOW_NATIVE_SCRIPT = false;
