//! Whether a word is legal Gurzûl Khar.
//!
//! Every violation carries a stable [`PhonotacticCode`]. The human-readable
//! message may be reworded freely; the code may not, because it is what
//! `tests/fixtures/phonotactics.json` pins and what both engines must agree
//! on, word for word, in order.

use crate::data::{CODA_CLUSTERS, ONSET_CLUSTERS};
use crate::phonology::phonemes::{try_tokenize_word, PhonemeToken};
use crate::phonology::syllabify::syllabify;

/// A machine-readable identifier for one documented restriction.
///
/// These strings are a contract shared with the TypeScript engine. Renaming
/// one breaks the shared fixtures, which is the intended alarm.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhonotacticCode {
    /// The word uses a sound or digraph outside the declared inventory.
    TokenizationFailed,
    /// The word is empty.
    EmptyWord,
    /// ng and zh never occur word-initially.
    InitialNgZh,
    /// q, w and y never occur word-finally.
    FinalQWY,
    /// gh and zh may close a word only after a long vowel.
    FinalVoicedFricative,
    /// More than two consonants in an onset.
    OnsetTooLong,
    /// A two-consonant onset outside the allowed table.
    OnsetNotAllowed,
    /// More than two consonants in a coda.
    CodaTooLong,
    /// A two-consonant coda outside the allowed table.
    CodaNotAllowed,
}

impl PhonotacticCode {
    /// The wire form, identical to the TypeScript `PhonotacticCode` union.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TokenizationFailed => "tokenization-failed",
            Self::EmptyWord => "empty-word",
            Self::InitialNgZh => "initial-ng-zh",
            Self::FinalQWY => "final-q-w-y",
            Self::FinalVoicedFricative => "final-voiced-fricative",
            Self::OnsetTooLong => "onset-too-long",
            Self::OnsetNotAllowed => "onset-not-allowed",
            Self::CodaTooLong => "coda-too-long",
            Self::CodaNotAllowed => "coda-not-allowed",
        }
    }
}

/// One way in which a word breaks the rules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhonotacticViolation {
    /// The word that was checked.
    pub word: String,
    /// The stable identifier for the rule broken.
    pub code: PhonotacticCode,
    /// A human-readable explanation. Not a contract — reword freely.
    pub rule: String,
}

fn latin_of(tokens: &[PhonemeToken]) -> String {
    tokens.iter().map(|t| t.latin).collect()
}

/// Checks one bare word (no hyphens) against every documented restriction.
/// An empty result means the word is fully legal.
pub fn check_word_phonotactics(word: &str) -> Vec<PhonotacticViolation> {
    let mut violations = Vec::new();
    let push = |violations: &mut Vec<PhonotacticViolation>, code: PhonotacticCode, rule: String| {
        violations.push(PhonotacticViolation { word: word.to_string(), code, rule });
    };

    let tokens = match try_tokenize_word(word) {
        Some(t) => t,
        None => {
            push(
                &mut violations,
                PhonotacticCode::TokenizationFailed,
                "uses a sound/digraph outside the declared inventory".to_string(),
            );
            return violations;
        }
    };

    if tokens.is_empty() {
        push(&mut violations, PhonotacticCode::EmptyWord, "empty word".to_string());
        return violations;
    }

    let first = &tokens[0];
    let last = &tokens[tokens.len() - 1];

    if first.kind == crate::phonology::phonemes::PhonemeKind::Consonant && (first.id == "ng" || first.id == "zh") {
        push(
            &mut violations,
            PhonotacticCode::InitialNgZh,
            "word-initial restriction: ng/zh never occur word-initially".to_string(),
        );
    }

    if last.kind == crate::phonology::phonemes::PhonemeKind::Consonant
        && matches!(last.id, "q" | "w" | "y")
    {
        push(
            &mut violations,
            PhonotacticCode::FinalQWY,
            "word-final restriction: q/w/y never occur word-finally".to_string(),
        );
    }

    if last.kind == crate::phonology::phonemes::PhonemeKind::Consonant && (last.id == "gh" || last.id == "zh") {
        let prev = tokens.len().checked_sub(2).map(|i| &tokens[i]);
        let after_long_vowel = matches!(prev, Some(p) if p.is_vowel() && p.is_long);
        if !after_long_vowel {
            push(
                &mut violations,
                PhonotacticCode::FinalVoicedFricative,
                "word-final restriction: voiced fricatives gh/zh may close a word only after a long vowel".to_string(),
            );
        }
    }

    for syl in syllabify(&tokens) {
        if syl.onset.len() > 2 {
            push(
                &mut violations,
                PhonotacticCode::OnsetTooLong,
                format!("onset cluster too long ({})", latin_of(&syl.onset)),
            );
        }
        if syl.onset.len() == 2 && !ONSET_CLUSTERS.contains(&latin_of(&syl.onset).as_str()) {
            push(
                &mut violations,
                PhonotacticCode::OnsetNotAllowed,
                format!("onset cluster not in allowed list ({})", latin_of(&syl.onset)),
            );
        }
        if syl.coda.len() > 2 {
            push(
                &mut violations,
                PhonotacticCode::CodaTooLong,
                format!("coda cluster too long ({})", latin_of(&syl.coda)),
            );
        }
        if syl.coda.len() == 2 && !CODA_CLUSTERS.contains(&latin_of(&syl.coda).as_str()) {
            push(
                &mut violations,
                PhonotacticCode::CodaNotAllowed,
                format!("coda cluster not in allowed list ({})", latin_of(&syl.coda)),
            );
        }
    }

    violations
}

/// True when the word has no documented violations.
pub fn is_phonotactically_valid(word: &str) -> bool {
    check_word_phonotactics(word).is_empty()
}
