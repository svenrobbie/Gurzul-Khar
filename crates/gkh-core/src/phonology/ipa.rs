//! IPA transcription.
//!
//! This is the authority for how a word is pronounced: every `ipa` field in
//! the lexicon is generated from here rather than written by hand, which makes
//! the 301-entry lexicon a fixture the Rust port has to reproduce exactly.

use crate::phonology::phonemes::tokenize_word;
use crate::phonology::stress::stressed_syllable_index;
use crate::phonology::syllabify::{syllabify, Syllable};

fn syllable_ipa(syl: &Syllable) -> String {
    let mut out: String = syl.onset.iter().map(|t| t.ipa).collect();
    out.push_str(syl.nucleus.ipa);
    out.extend(syl.coda.iter().map(|t| t.ipa));
    out
}

/// Full IPA for one written word, with primary stress marked.
///
/// Returns an empty string for a word outside the inventory — the same
/// choice the TypeScript makes, so a caller showing pronunciation renders
/// nothing rather than something invented.
pub fn ipa_of_word(word: &str) -> String {
    let tokens = match tokenize_word(word) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    let syllables = syllabify(&tokens);
    if syllables.is_empty() {
        return tokens.iter().map(|t| t.ipa).collect();
    }

    let stress_idx = stressed_syllable_index(&syllables);
    syllables
        .iter()
        .enumerate()
        .map(|(i, syl)| {
            let mark = if Some(i) == stress_idx { "ˈ" } else { "" };
            format!("{mark}{}", syllable_ipa(syl))
        })
        .collect()
}

/// IPA for a whole sentence, each word delimited by slashes.
pub fn ipa_of_sentence(text: &str) -> String {
    text.split_whitespace()
        .map(|w| format!("/{}/", ipa_of_word(w)))
        .collect::<Vec<_>>()
        .join(" ")
}
