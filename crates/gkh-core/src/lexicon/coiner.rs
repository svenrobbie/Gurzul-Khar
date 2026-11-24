//! `coiner_v1` — the deterministic fallback that gives every input word a
//! Gurzûl Khar form, identical on every run, every build and every platform.
//!
//! **This is a port of a FROZEN algorithm.** Nothing here that affects output
//! may change: not a weight, not a table order, not the hash. The TypeScript
//! implementation in `engine/lexicon/coiner.ts` and this one must agree on all
//! 10,549 pinned coinages, and `tests/coiner_golden.rs` asserts exactly that.
//! Improvements ship as a `coiner_v2` in both languages at once.
//!
//! ## Why this port is the risky one
//!
//! The TypeScript original does its arithmetic in `BigInt`, masked to 64 bits
//! at every step. Rust has real `u64`, so the masking disappears and wrapping
//! does the same job — but only if every operation wraps the same way and the
//! hash sees exactly the same bytes. Three things had to be preserved
//! deliberately rather than translated:
//!
//! 1. The sub-seed label is built from the root hash formatted as **lowercase
//!    hex, zero-padded to 16 characters** — JavaScript's
//!    `root.toString(16).padStart(16, "0")`. A different width or case hashes
//!    different bytes and every coined word changes.
//! 2. Candidate length is measured in **characters, not bytes**. JavaScript's
//!    `.length` counts UTF-16 units, which for this alphabet equals the
//!    character count; Rust's `len()` counts bytes, and "bâ" is 3 bytes but 2
//!    characters.
//! 3. No floating point anywhere. Every draw is integer modulo, because float
//!    rounding is not guaranteed identical across platforms.

use crate::data::coiner::*;
use crate::data::LONG_VOWELS;
use crate::phonology::{check_word_phonotactics, try_tokenize_word, PhonemeKind};
use std::fmt;

/// The frozen version tag. A change in behaviour means a new version, never an
/// edit to this one.
pub const COINER_VERSION: &str = "v1";

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// How many candidates to try before giving up. Coining 150,000 words needs at
/// most 32, so this is a safety net rather than a working limit.
const MAX_ATTEMPTS: u32 = 64;

/// FNV-1a over raw UTF-8 bytes, 64-bit, wrapping. The one hash this file uses.
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut h = FNV_OFFSET;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(FNV_PRIME);
    }
    h
}

fn hash_str(s: &str) -> u64 {
    fnv1a64(s.as_bytes())
}

/// An independent 64-bit value for one decision.
///
/// `label` names the decision ("count", "onset0", "vowelPick1"), so two
/// decisions never share a stream and tuning one cannot disturb another. The
/// hex formatting here is load-bearing: see the module note.
fn field(root: u64, label: &str) -> u64 {
    hash_str(&format!("{root:016x}:{label}"))
}

/// A percentage roll: true when the derived value falls under `percent` of 100.
fn roll(root: u64, label: &str, percent: u64) -> bool {
    field(root, label) % 100 < percent
}

/// A weighted draw over cumulative integer weights. No floating point.
fn weighted(root: u64, label: &str, table: &[WeightedUnit]) -> &'static str {
    let total: u64 = table.iter().map(|u| u.weight).sum();
    debug_assert!(total > 0, "empty weight table");
    let mut target = field(root, label) % total;
    for unit in table {
        if target < unit.weight {
            return unit.unit;
        }
        target -= unit.weight;
    }
    table[table.len() - 1].unit
}

/// What to coin a word for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinInput {
    /// The dictionary form, already lemmatised. "huizen" must arrive as "huis".
    pub lemma: String,
    /// Part of speech, so "work" as a noun and as a verb can differ.
    pub pos: String,
    /// Source language of the lemma: "en" or "nl".
    pub lang: String,
}

/// A coined word.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinedWord {
    /// The Gurzûl Khar spelling.
    pub gkh: String,
    /// The frozen version that produced it.
    pub version: &'static str,
    /// How many candidates were rejected first. Part of the contract.
    pub attempt: u32,
    /// The normalised seed, for debugging and for the coinage index.
    pub seed: String,
}

/// The coiner could not find a valid candidate. Unreachable in practice.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinerError {
    /// The seed that failed.
    pub seed: String,
}

impl fmt::Display for CoinerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "coiner_v1: no valid candidate for {:?} within {MAX_ATTEMPTS} attempts; \
             the phoneme inventory or the weights must have changed",
            self.seed
        )
    }
}

impl std::error::Error for CoinerError {}

/// Canonical seed text.
///
/// Everything that is not a letter or a digit becomes a space, runs of spaces
/// collapse, case is folded, and the parts join with `|`. So "Huis!", "huis"
/// and "HUIS" are one input.
///
/// The TypeScript original also applies Unicode NFC normalisation. Rust's
/// standard library has no normaliser and this crate takes no dependencies, so
/// input is assumed to be NFC already — true of every source in this project.
/// The golden-file test is what proves the assumption holds: if a composed and
/// a decomposed spelling ever diverged, 10,549 cases would catch it.
pub fn normalise_seed(input: &CoinInput) -> String {
    fn clean(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        let mut pending_space = false;
        for ch in s.chars() {
            if ch.is_alphanumeric() {
                if pending_space && !out.is_empty() {
                    out.push(' ');
                }
                pending_space = false;
                out.extend(ch.to_lowercase());
            } else {
                pending_space = true;
            }
        }
        out
    }

    format!("{}|{}|{}", clean(&input.lemma), clean(&input.pos), clean(&input.lang))
}

/// Long-vowel spellings, used to split the nucleus table by length.
fn is_long_nucleus(unit: &str) -> bool {
    LONG_VOWELS.iter().any(|v| v.latin == unit)
}

fn short_nuclei() -> Vec<WeightedUnit> {
    NUCLEI
        .iter()
        .filter(|u| !is_long_nucleus(u.unit))
        .map(|u| WeightedUnit { unit: u.unit, weight: u.weight })
        .collect()
}

fn long_nuclei() -> Vec<WeightedUnit> {
    NUCLEI
        .iter()
        .filter(|u| is_long_nucleus(u.unit))
        .map(|u| WeightedUnit { unit: u.unit, weight: u.weight })
        .collect()
}

fn build_syllable(root: u64, index: usize, is_first: bool, is_last: bool) -> String {
    let mut out = String::new();

    if is_first {
        if roll(root, &format!("onset{index}"), ONSET_FIRST_PERCENT) {
            out.push_str(weighted(root, &format!("onsetPick{index}"), ONSET_INITIAL));
        }
    } else if roll(root, &format!("onset{index}"), ONSET_MEDIAL_PERCENT) {
        out.push_str(weighted(root, &format!("onsetPick{index}"), ONSET_MEDIAL));
    }

    let long = roll(root, &format!("vowelLength{index}"), LONG_VOWEL_PERCENT);
    let table = if long { long_nuclei() } else { short_nuclei() };
    out.push_str(weighted(root, &format!("vowelPick{index}"), &table));

    if is_last {
        if roll(root, &format!("coda{index}"), CODA_FINAL_PERCENT) {
            out.push_str(weighted(root, &format!("codaPick{index}"), CODA_FINAL));
        }
    } else if roll(root, &format!("coda{index}"), CODA_MEDIAL_PERCENT) {
        out.push_str(weighted(root, &format!("codaPick{index}"), CODA_MEDIAL));
    }

    out
}

fn candidate_for(seed: &str, attempt: u32) -> String {
    let root = if attempt == 0 {
        hash_str(seed)
    } else {
        hash_str(&format!("{seed}#{attempt}"))
    };

    let dice = field(root, "count") % 100;
    let base: usize = if dice < SYLLABLE_ONE_PERCENT {
        1
    } else if dice < SYLLABLE_TWO_PERCENT {
        2
    } else {
        3
    };

    // The one-and-two-syllable space saturates at roughly the size of a real
    // vocabulary, so the floor rises as attempts mount: common words stay
    // short, the long tail gets longer, which is how languages behave anyway.
    let floor: usize = if attempt >= 24 {
        3
    } else if attempt >= 8 {
        2
    } else {
        1
    };
    let syllable_count = base.max(floor);

    (0..syllable_count)
        .map(|i| build_syllable(root, i, i == 0, i == syllable_count - 1))
        .collect()
}

/// Euphony rules the lexicon obeys without ever stating them.
///
/// Not one of the 292 hand-authored entries contains a doubled letter, a run
/// of three vowels, or three consonant phonemes in a row. Syllable
/// concatenation produces all three, and they are the main thing that makes a
/// coined word read as machine-made.
fn breaks_euphony(word: &str) -> bool {
    let chars: Vec<char> = word.chars().collect();

    for pair in chars.windows(2) {
        if pair[0] == pair[1] {
            return true;
        }
    }

    const VOWEL_CHARS: &[char] = &['a', 'e', 'i', 'o', 'u', 'â', 'û', 'ü', 'ê', 'î', 'ô', 'y'];
    let mut vowel_run = 0usize;
    for ch in &chars {
        if VOWEL_CHARS.contains(ch) {
            vowel_run += 1;
            if vowel_run >= 3 {
                return true;
            }
        } else {
            vowel_run = 0;
        }
    }

    // Counted after tokenisation, so the "rth" of garth is two phonemes.
    if let Some(tokens) = try_tokenize_word(word) {
        let mut run = 0usize;
        for token in &tokens {
            if token.kind == PhonemeKind::Vowel {
                run = 0;
            } else {
                run += 1;
                if run >= 3 {
                    return true;
                }
            }
        }
    }

    false
}

/// Coins the Gurzûl Khar form for a gloss the lexicon does not contain.
///
/// A pure function of (lemma, pos, lang, `taken`): the same values give the
/// same word on any machine, in any build.
///
/// `taken` lets the caller reserve forms already coined for OTHER glosses, so
/// two meanings never share a spelling. Callers keeping a coinage index should
/// pass it; callers that do not still get results free of collisions with the
/// hand-authored lexicon.
pub fn coin(input: &CoinInput, taken: &[String]) -> Result<CoinedWord, CoinerError> {
    let seed = normalise_seed(input);

    for attempt in 0..MAX_ATTEMPTS {
        let gkh = candidate_for(&seed, attempt);

        // Characters, not bytes — see the module note.
        if gkh.chars().count() < 2 {
            continue;
        }
        if !check_word_phonotactics(&gkh).is_empty() {
            continue;
        }
        if breaks_euphony(&gkh) {
            continue;
        }
        if RESERVED_FORMS.contains(&gkh.as_str()) {
            continue;
        }
        if taken.iter().any(|t| t == &gkh) {
            continue;
        }

        return Ok(CoinedWord { gkh, version: COINER_VERSION, attempt, seed });
    }

    Err(CoinerError { seed })
}
