//! The language data, compiled in.
//!
//! Everything here is generated from the JSON in `data/` by
//! `scripts/buildRustData.mjs`. Nothing in this module is hand-written, and
//! nothing reads a file at runtime.

mod generated;

pub use generated::*;

/// Every vowel the language declares, in the order the tokenizer should prefer
/// when two spellings are the same length: diphthongs, then long, then short.
pub fn all_vowels() -> impl Iterator<Item = &'static Vowel> {
    DIPHTHONGS.iter().chain(LONG_VOWELS.iter()).chain(SHORT_VOWELS.iter())
}

/// Looks up a consonant by its phonology id (`"kh"`, `"ng"`, ...).
pub fn consonant(id: &str) -> Option<&'static Consonant> {
    CONSONANTS.iter().find(|c| c.id == id)
}
