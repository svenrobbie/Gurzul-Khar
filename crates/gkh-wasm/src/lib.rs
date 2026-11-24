//! WebAssembly bindings for [`gkh_core`].
//!
//! A thin translation layer and nothing else. No language logic lives here —
//! every decision about Gurzûl Khar is made in the core, so the website, the
//! Android app and the test suite cannot disagree about what the language is.
//!
//! The boundary is kept deliberately simple: JavaScript gets plain strings and
//! small JSON-shaped objects, built here by hand rather than through a
//! serialisation dependency. That keeps the crate's dependency list to
//! `wasm-bindgen` alone and the shipped artifact small, since this is
//! downloaded by every visitor to the site.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use gkh_core::lexicon::{coin as core_coin, normalise_seed, CoinInput};
use gkh_core::morphology::{guess_lemma, lemmatize as core_lemmatize, Lang, LemmaKind};
use gkh_core::data::CONSONANTS;
use gkh_core::phonology::{
    check_word_phonotactics, ipa_of_sentence, ipa_of_word, syllabify, try_tokenize_word, PhonemeKind,
    PhonemeToken, Syllable,
};
use gkh_core::morphology::{find_by_dutch, find_by_english};
use gkh_core::translator::{analyze_word, translate as core_translate, Direction, Translation};
use wasm_bindgen::prelude::*;

/// Escapes a string for embedding in JSON.
fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn json_string(s: &str) -> String {
    format!("\"{}\"", json_escape(s))
}

fn json_array(items: &[String]) -> String {
    format!("[{}]", items.join(","))
}

/// The engine's version, so a page can show which implementation it is running.
#[wasm_bindgen]
pub fn engine_version() -> String {
    format!("gkh-core {} (rust/wasm)", env!("CARGO_PKG_VERSION"))
}

/// Translates one sentence.
///
/// `direction` is one of `"en-gkh"`, `"nl-gkh"`, `"gkh-en"`, `"gkh-nl"`.
///
/// Returns JSON. On success:
/// `{ ok: true, output, pronunciation, partial, unknownWords, coinedWords, transformations }`.
/// On refusal: `{ ok: false, reason, error }`.
#[wasm_bindgen]
pub fn translate(input: &str, direction: &str) -> String {
    let Some(dir) = Direction::from_code(direction) else {
        return format!(
            "{{\"ok\":false,\"reason\":\"bad-direction\",\"error\":{}}}",
            json_string(&format!("unknown direction {direction:?}"))
        );
    };

    match core_translate(input, dir) {
        Translation::Ok(ok) => {
            let unknown: Vec<String> = ok.unknown_words.iter().map(|w| json_string(w)).collect();
            let coined: Vec<String> = ok
                .coined_words
                .iter()
                .map(|c| {
                    format!(
                        "{{\"source\":{},\"gkh\":{},\"version\":{}}}",
                        json_string(&c.source),
                        json_string(&c.gkh),
                        json_string(c.version)
                    )
                })
                .collect();
            let transformations: Vec<String> = ok.transformations.iter().map(|t| json_string(t)).collect();

            format!(
                "{{\"ok\":true,\"output\":{},\"pronunciation\":{},\"partial\":{},\"unknownWords\":{},\"coinedWords\":{},\"transformations\":{}}}",
                json_string(&ok.output),
                ok.pronunciation.as_deref().map(json_string).unwrap_or_else(|| "null".to_string()),
                ok.partial,
                json_array(&unknown),
                json_array(&coined),
                json_array(&transformations)
            )
        }
        Translation::Failed { reason } => {
            let (code, message) = match &reason {
                gkh_core::translator::ParseFailure::UnknownWord(w) => (
                    "unknown-word",
                    format!("The word \"{w}\" is not in the lexicon, so this cannot be translated reliably."),
                ),
                gkh_core::translator::ParseFailure::EmptyInput => {
                    ("empty-input", "No text was provided to translate.".to_string())
                }
                gkh_core::translator::ParseFailure::UnsupportedPattern => (
                    "unsupported-pattern",
                    "This sentence does not match any grammatical pattern the translator supports. \
                     Every word may be known — it is the structure that is missing, and guessing at \
                     it would read as a translation while losing the grammar."
                        .to_string(),
                ),
            };
            format!(
                "{{\"ok\":false,\"reason\":{},\"error\":{}}}",
                json_string(code),
                json_string(&message)
            )
        }
    }
}

/// IPA for one written Gurzûl Khar word. Empty when the word is outside the
/// declared inventory — nothing is invented.
#[wasm_bindgen]
pub fn word_ipa(word: &str) -> String {
    ipa_of_word(word)
}

/// IPA for a whole sentence, each word delimited by slashes.
#[wasm_bindgen]
pub fn sentence_ipa(text: &str) -> String {
    ipa_of_sentence(text)
}

/// Resolves a source-language word through the lexicon.
///
/// Returns JSON: `{ kind, gkh, parts }`, or `null` when nothing in the lexicon
/// accounts for the word — which is the one case where coining is correct.
#[wasm_bindgen]
pub fn lemmatize(word: &str, lang: &str) -> String {
    let Some(lang) = Lang::from_code(lang) else {
        return "null".to_string();
    };
    match core_lemmatize(word, lang) {
        None => "null".to_string(),
        Some(result) => {
            let kind = match result.kind {
                LemmaKind::Direct => "direct",
                LemmaKind::Inflected => "inflected",
                LemmaKind::Compound => "compound",
            };
            let parts: Vec<String> = result.parts.iter().map(|p| json_string(p.entry.gkh)).collect();
            format!(
                "{{\"kind\":{},\"gkh\":{},\"parts\":{}}}",
                json_string(kind),
                json_string(&result.gkh),
                json_array(&parts)
            )
        }
    }
}

/// Coins a word for a gloss the lexicon does not have.
///
/// Deterministic: the same lemma, part of speech and language always give the
/// same word, on every platform.
#[wasm_bindgen]
pub fn coin(lemma: &str, pos: &str, lang: &str) -> String {
    let input = CoinInput {
        lemma: lemma.to_string(),
        pos: pos.to_string(),
        lang: lang.to_string(),
    };
    match core_coin(&input, &[]) {
        Ok(result) => format!(
            "{{\"gkh\":{},\"version\":{},\"attempt\":{}}}",
            json_string(&result.gkh),
            json_string(result.version),
            result.attempt
        ),
        Err(_) => "null".to_string(),
    }
}

/// The best-guess dictionary form used to seed the coiner, exposed so a caller
/// can show why two inflections produced one word.
#[wasm_bindgen]
pub fn lemma_guess(word: &str, lang: &str) -> String {
    match Lang::from_code(lang) {
        Some(lang) => guess_lemma(word, lang),
        None => word.to_string(),
    }
}

/// Word-by-word analysis for the translator's explanation panel.
///
/// Returns a JSON array of `{ surface, root, gloss, pos, affixes, ipa }`, one
/// per word. For a Gurzûl Khar source this is a real morphological analysis;
/// for English or Dutch it is a lexicon lookup, which is all the TypeScript
/// engine does for those too.
#[wasm_bindgen]
pub fn analyze_sentence(text: &str, direction: &str) -> String {
    let Some(dir) = Direction::from_code(direction) else {
        return "[]".to_string();
    };

    let words: Vec<String> = text
        .trim()
        .trim_end_matches(['?', '.', '!'])
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| ",;:\"'()[]".contains(c)).to_lowercase())
        .filter(|w| !w.is_empty())
        .collect();

    let source_is_gkh = !dir.targets_gkh();

    let rows: Vec<String> = words
        .iter()
        .map(|word| {
            if source_is_gkh {
                let analysis = analyze_word(word);
                let gloss = analysis
                    .entry
                    .map(|e| format!("{} / {}", e.en, e.nl))
                    .unwrap_or_else(|| "(unrecognized)".to_string());
                let affixes: Vec<String> = analysis
                    .affixes
                    .iter()
                    .map(|a| format!("{} ({})", a.suffix, a.gloss))
                    .map(|s| json_string(&s))
                    .collect();
                format!(
                    "{{\"surface\":{},\"root\":{},\"gloss\":{},\"pos\":{},\"affixes\":{},\"ipa\":{}}}",
                    json_string(word),
                    json_string(&analysis.root),
                    json_string(&gloss),
                    analysis.entry.map(|e| json_string(e.pos)).unwrap_or_else(|| "null".to_string()),
                    json_array(&affixes),
                    json_string(&ipa_of_word(word))
                )
            } else {
                let entry = match dir.natural_lang() {
                    Lang::En => find_by_english(word),
                    Lang::Nl => find_by_dutch(word),
                };
                format!(
                    "{{\"surface\":{},\"root\":{},\"gloss\":{},\"pos\":{},\"affixes\":[],\"ipa\":{}}}",
                    json_string(word),
                    json_string(entry.map(|e| e.root.unwrap_or(e.gkh)).unwrap_or(word)),
                    json_string(entry.map(|e| e.gkh).unwrap_or("(not found in lexicon)")),
                    entry.map(|e| json_string(e.pos)).unwrap_or_else(|| "null".to_string()),
                    json_string(entry.map(|e| e.ipa).unwrap_or(""))
                )
            }
        })
        .collect();

    json_array(&rows)
}

/// Serialises one phoneme token. Place, manner and voicing are looked up from
/// the consonant inventory rather than carried on the token, so the core's
/// `PhonemeToken` stays as small as the engine needs it.
fn token_json(t: &PhonemeToken) -> String {
    let (place, manner, voicing) = CONSONANTS
        .iter()
        .find(|c| c.id == t.id)
        .map(|c| (c.place, c.manner, c.voicing))
        .unwrap_or(("", "", ""));
    format!(
        "{{\"kind\":{},\"id\":{},\"latin\":{},\"ipa\":{},\"isLong\":{},\"isDiphthong\":{},\"place\":{},\"manner\":{},\"voicing\":{}}}",
        json_string(match t.kind {
            PhonemeKind::Consonant => "consonant",
            PhonemeKind::Vowel => "vowel",
        }),
        json_string(t.id),
        json_string(t.latin),
        json_string(t.ipa),
        t.is_long,
        t.is_diphthong,
        json_string(place),
        json_string(manner),
        json_string(voicing)
    )
}

fn syllable_json(s: &Syllable) -> String {
    let onset: Vec<String> = s.onset.iter().map(token_json).collect();
    let coda: Vec<String> = s.coda.iter().map(token_json).collect();
    format!(
        "{{\"onset\":{},\"nucleus\":{},\"coda\":{}}}",
        json_array(&onset),
        token_json(&s.nucleus),
        json_array(&coda)
    )
}

/// Checks a word against every documented phonotactic rule.
///
/// Returns a JSON array of `{ word, code, rule }`, empty when the word is
/// legal. `code` is the stable identifier; `rule` is prose and may be reworded.
#[wasm_bindgen]
pub fn check_word(word: &str) -> String {
    let rows: Vec<String> = check_word_phonotactics(word)
        .iter()
        .map(|v| {
            format!(
                "{{\"word\":{},\"code\":{},\"rule\":{}}}",
                json_string(&v.word),
                json_string(v.code.as_str()),
                json_string(&v.rule)
            )
        })
        .collect();
    json_array(&rows)
}

/// Splits a word into phoneme tokens.
///
/// Returns a JSON array, or `null` when the word uses a sound outside the
/// declared inventory — the caller is expected to say so rather than guess.
#[wasm_bindgen]
pub fn tokenize(word: &str) -> String {
    match try_tokenize_word(word) {
        None => "null".to_string(),
        Some(tokens) => {
            let rows: Vec<String> = tokens.iter().map(token_json).collect();
            json_array(&rows)
        }
    }
}

/// Prepares text for native-script rendering.
///
/// Returns a JSON array of parts, in input order. A word is
/// `{ kind: "word", original, syllables, latin }`; anything between words
/// (spaces, punctuation) is `{ kind: "text", text }` and is passed through
/// untouched, so the round trip is lossless. A word the inventory cannot
/// account for comes back as a `"text"` part rather than a mangled one.
///
/// Drawing the glyphs is the website's job: this returns the syllable blocks
/// the script is built from, not SVG. Geometry does not belong in the language.
#[wasm_bindgen]
pub fn transliterate(text: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut buffer = String::new();
    let mut is_letters = false;

    let is_letter = |c: char| c.is_alphabetic();

    let flush = |buffer: &mut String, is_letters: bool, parts: &mut Vec<String>| {
        if buffer.is_empty() {
            return;
        }
        if is_letters {
            if let Some(tokens) = try_tokenize_word(buffer) {
                let syllables: Vec<String> = syllabify(&tokens).iter().map(syllable_json).collect();
                let latin: String = tokens.iter().map(|t| t.latin).collect();
                parts.push(format!(
                    "{{\"kind\":\"word\",\"original\":{},\"syllables\":{},\"latin\":{}}}",
                    json_string(buffer),
                    json_array(&syllables),
                    json_string(&latin)
                ));
                buffer.clear();
                return;
            }
        }
        parts.push(format!("{{\"kind\":\"text\",\"text\":{}}}", json_string(buffer)));
        buffer.clear();
    };

    for ch in text.chars() {
        let letter = is_letter(ch);
        if !buffer.is_empty() && letter != is_letters {
            flush(&mut buffer, is_letters, &mut parts);
        }
        is_letters = letter;
        buffer.push(ch);
    }
    flush(&mut buffer, is_letters, &mut parts);

    json_array(&parts)
}

/// The normalised seed for a gloss: lowercase, NFC, punctuation stripped,
/// joined as `lemma|pos|lang`. Exposed so tooling can deduplicate inputs by
/// exactly what the coiner keys on, rather than by a near-enough string.
#[wasm_bindgen]
pub fn normalise_seed_for(lemma: &str, pos: &str, lang: &str) -> String {
    normalise_seed(&CoinInput {
        lemma: lemma.to_string(),
        pos: pos.to_string(),
        lang: lang.to_string(),
    })
}

/// Coins a whole list in one call, keeping one reserved set across it.
///
/// Collision resolution depends on what has already been issued, so coining a
/// list one call at a time — each with an empty reserved set — would give a
/// different and wrong answer. This is how the golden file and the coinage
/// index are built.
///
/// Input is tab-separated `lemma\tpos\tlang`, one per line. Output is the same
/// line with `\tgkh\tattempt` appended. A line the coiner cannot satisfy gets
/// an empty spelling and an attempt of `-1` rather than being dropped, so the
/// output lines up with the input.
#[wasm_bindgen]
pub fn coin_batch(tsv: &str) -> String {
    let mut taken: Vec<String> = Vec::new();
    let mut out = String::new();

    for line in tsv.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let mut fields = line.split('\t');
        let lemma = fields.next().unwrap_or("");
        let pos = fields.next().unwrap_or("noun");
        let lang = fields.next().unwrap_or("en");
        let input = CoinInput {
            lemma: lemma.to_string(),
            pos: pos.to_string(),
            lang: lang.to_string(),
        };
        match core_coin(&input, &taken) {
            Ok(result) => {
                out.push_str(&format!("{lemma}\t{pos}\t{lang}\t{}\t{}\n", result.gkh, result.attempt));
                taken.push(result.gkh);
            }
            Err(_) => out.push_str(&format!("{lemma}\t{pos}\t{lang}\t\t-1\n")),
        }
    }

    out
}
