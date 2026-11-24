//! Turns a Latin-transliterated word into an ordered stream of phonemes,
//! using only the inventory declared in `data/phonology/phonology.json`.
//!
//! No phoneme is invented here. If a word contains a sequence the inventory
//! does not account for, tokenization fails rather than guessing — the same
//! choice the TypeScript engine makes, and the reason an unknown spelling is
//! reported honestly instead of being silently mangled.

use crate::data::{all_vowels, CONSONANTS};
use std::fmt;

/// Whether a token is a consonant or a vowel.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhonemeKind {
    /// A consonant, including the digraphs kh, gh, sh, zh, th and ng.
    Consonant,
    /// A vowel: short, long, or a diphthong — all atomic.
    Vowel,
}

/// One phoneme, with the literal text it consumed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhonemeToken {
    /// What kind of sound this is.
    pub kind: PhonemeKind,
    /// The phonology id, e.g. `"kh"`, `"â"`, `"ai"`.
    pub id: &'static str,
    /// The literal substring consumed, lowercased. For a written variant such
    /// as "ü" this is the variant as written, while `id` is the vowel it is a
    /// variant of.
    pub latin: &'static str,
    /// IPA for this phoneme.
    pub ipa: &'static str,
    /// True for a long vowel.
    pub is_long: bool,
    /// True for a diphthong.
    pub is_diphthong: bool,
}

impl PhonemeToken {
    /// True when this token is a vowel of any kind.
    pub fn is_vowel(&self) -> bool {
        self.kind == PhonemeKind::Vowel
    }
}

/// A word could not be tokenized: it contains a sequence outside the declared
/// inventory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnrecognizedPhoneme {
    /// The whole word that failed.
    pub word: String,
    /// The unconsumed remainder, starting at the offending character.
    pub remainder: String,
}

impl fmt::Display for UnrecognizedPhoneme {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "cannot tokenize {:?}: unrecognized sequence starting at {:?}",
            self.word, self.remainder
        )
    }
}

impl std::error::Error for UnrecognizedPhoneme {}

/// One spelling the tokenizer can match, and the token it produces.
struct LatinEntry {
    latin: &'static str,
    token: PhonemeToken,
}

/// The match table, longest spelling first.
///
/// Longest-match-first is what makes the digraphs work: without it, "kh" would
/// tokenize as k followed by h, and "khar" would become a different word.
/// Built on first use and then reused.
fn latin_table() -> &'static [LatinEntry] {
    use std::sync::OnceLock;
    static TABLE: OnceLock<Vec<LatinEntry>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let mut table: Vec<LatinEntry> = Vec::new();

        for c in CONSONANTS {
            table.push(LatinEntry {
                latin: c.latin,
                token: PhonemeToken {
                    kind: PhonemeKind::Consonant,
                    id: c.id,
                    latin: c.latin,
                    ipa: c.ipa,
                    is_long: false,
                    is_diphthong: false,
                },
            });
        }

        for v in all_vowels() {
            table.push(LatinEntry {
                latin: v.latin,
                token: PhonemeToken {
                    kind: PhonemeKind::Vowel,
                    id: v.id,
                    latin: v.latin,
                    ipa: v.ipa,
                    is_long: v.is_long,
                    is_diphthong: v.is_diphthong,
                },
            });
            // An accepted alternate spelling produces the same phoneme: "ük"
            // and "ûk" are one word written two ways.
            for variant in v.written_variants {
                table.push(LatinEntry {
                    latin: variant,
                    token: PhonemeToken {
                        kind: PhonemeKind::Vowel,
                        id: v.id,
                        latin: variant,
                        ipa: v.ipa,
                        is_long: v.is_long,
                        is_diphthong: v.is_diphthong,
                    },
                });
            }
        }

        // Stable sort by byte length, longest first. Two entries never share a
        // spelling, so ties among equal lengths cannot change what matches.
        table.sort_by(|a, b| b.latin.len().cmp(&a.latin.len()));
        table
    })
}

/// Tokenizes one Latin-transliterated word. Greedy longest match, left to right.
pub fn tokenize_word(word: &str) -> Result<Vec<PhonemeToken>, UnrecognizedPhoneme> {
    let lowered = word.to_lowercase();
    let mut tokens = Vec::new();
    let mut i = 0usize;

    'outer: while i < lowered.len() {
        for entry in latin_table() {
            if lowered[i..].starts_with(entry.latin) {
                tokens.push(entry.token.clone());
                i += entry.latin.len();
                continue 'outer;
            }
        }
        return Err(UnrecognizedPhoneme {
            word: lowered.clone(),
            remainder: lowered[i..].to_string(),
        });
    }

    Ok(tokens)
}

/// Tokenizes, or returns `None` — for paths where a bad word is an expected
/// input rather than a bug.
pub fn try_tokenize_word(word: &str) -> Option<Vec<PhonemeToken>> {
    tokenize_word(word).ok()
}

/// Reassembles tokens into the spelling they came from.
pub fn phonemes_to_latin(tokens: &[PhonemeToken]) -> String {
    tokens.iter().map(|t| t.latin).collect()
}
