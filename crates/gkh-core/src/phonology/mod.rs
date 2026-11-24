//! Sounds: how a written word becomes a stream of phonemes, how that stream
//! divides into syllables, and whether the result is a legal word.

mod phonemes;
mod phonotactics;
mod syllabify;

pub use phonemes::{phonemes_to_latin, tokenize_word, try_tokenize_word, PhonemeKind, PhonemeToken, UnrecognizedPhoneme};
pub use phonotactics::{check_word_phonotactics, is_phonotactically_valid, PhonotacticCode, PhonotacticViolation};
pub use syllabify::{syllabify, Syllable};
