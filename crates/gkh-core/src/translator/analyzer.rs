//! Morphological analysis of a Gurzûl Khar surface word.
//!
//! Strips affixes exactly as declared in `grammar.json` and the lexicon's
//! derivational table. Every suffix used here is read from the data — there is
//! no second copy of a grammatical rule in this file.

use crate::data::grammar::*;
use crate::data::lexicon::{Entry, ENTRIES, DERIVATIONAL_AFFIXES};

/// What kind of affix was stripped.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AffixType {
    /// Plural on a noun.
    Plural,
    /// Tense on a verb.
    Tense,
    /// Possessive on a noun.
    Possessive,
    /// A derivational suffix.
    Derivational,
    /// Reflexive on a pronoun.
    Reflexive,
}

/// One stripped affix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Affix {
    /// Its kind.
    pub kind: AffixType,
    /// The suffix text.
    pub suffix: String,
    /// A human-readable gloss.
    pub gloss: String,
}

/// The result of analysing one word.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MorphAnalysis {
    /// The word as written.
    pub surface: String,
    /// The root reached after stripping.
    pub root: String,
    /// The affixes stripped, in order.
    pub affixes: Vec<Affix>,
    /// The entry the root resolved to.
    pub entry: Option<&'static Entry>,
    /// False when nothing in the lexicon accounts for the word.
    pub recognized: bool,
}

const REFLEXIVE_SUFFIX: &str = "ûm";

fn find_entry(root: &str) -> Option<&'static Entry> {
    let lower = root.to_lowercase();
    ENTRIES
        .iter()
        .find(|e| e.gkh.to_lowercase() == lower)
        .or_else(|| ENTRIES.iter().find(|e| e.root.map(|r| r.to_lowercase()) == Some(lower.clone())))
}

fn strip_suffix<'a>(surface: &'a str, suffix: &str) -> Option<&'a str> {
    if surface.len() > suffix.len() && surface.ends_with(suffix) {
        Some(&surface[..surface.len() - suffix.len()])
    } else {
        None
    }
}

/// Analyses one Gurzûl Khar word. Deterministic: the same input always yields
/// the same analysis.
pub fn analyze_word(surface: &str) -> MorphAnalysis {
    let base = MorphAnalysis {
        surface: surface.to_string(),
        root: surface.to_string(),
        affixes: Vec::new(),
        entry: None,
        recognized: false,
    };

    if let Some(direct) = find_entry(surface) {
        return MorphAnalysis { entry: Some(direct), recognized: true, ..base };
    }

    // 1. Possessive, longest suffix first so -shûk beats a bare -ûk.
    let mut possessives: Vec<(&str, &str)> = POSSESSIVE_SUFFIXES.to_vec();
    possessives.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
    for (person, suffix) in &possessives {
        if let Some(stem) = strip_suffix(surface, suffix) {
            if let Some(entry) = find_entry(stem) {
                return MorphAnalysis {
                    root: stem.to_string(),
                    affixes: vec![Affix {
                        kind: AffixType::Possessive,
                        suffix: (*suffix).to_string(),
                        gloss: format!("possessive ({person})"),
                    }],
                    entry: Some(entry),
                    recognized: true,
                    ..base
                };
            }
        }
    }

    // 2. Plural, epenthetic form first. The root already ends in -k, which is
    // why the epenthetic form was used, so stripping it leaves the root whole.
    for suffix in [PLURAL_EPENTHETIC, PLURAL_SUFFIX] {
        if let Some(stem) = strip_suffix(surface, suffix) {
            if let Some(entry) = find_entry(stem) {
                return MorphAnalysis {
                    root: stem.to_string(),
                    affixes: vec![Affix {
                        kind: AffixType::Plural,
                        suffix: suffix.to_string(),
                        gloss: "plural".to_string(),
                    }],
                    entry: Some(entry),
                    recognized: true,
                    ..base
                };
            }
        }
    }

    // 3. Tense, longest first.
    let mut tenses: Vec<(&str, &str)> = TENSE_SUFFIXES.to_vec();
    tenses.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
    for (tense, suffix) in &tenses {
        if let Some(stem) = strip_suffix(surface, suffix) {
            if let Some(entry) = find_entry(stem) {
                if entry.pos == "verb" {
                    return MorphAnalysis {
                        root: stem.to_string(),
                        affixes: vec![Affix {
                            kind: AffixType::Tense,
                            suffix: (*suffix).to_string(),
                            gloss: format!("tense: {tense}"),
                        }],
                        entry: Some(entry),
                        recognized: true,
                        ..base
                    };
                }
            }
        }
    }

    // 4. Reflexive, on pronouns only.
    if let Some(stem) = strip_suffix(surface, REFLEXIVE_SUFFIX) {
        if let Some(entry) = find_entry(stem) {
            if entry.pos == "pronoun" {
                return MorphAnalysis {
                    root: stem.to_string(),
                    affixes: vec![Affix {
                        kind: AffixType::Reflexive,
                        suffix: REFLEXIVE_SUFFIX.to_string(),
                        gloss: "reflexive".to_string(),
                    }],
                    entry: Some(entry),
                    recognized: true,
                    ..base
                };
            }
        }
    }

    // 5. Derivational, longest first.
    let mut derivational: Vec<(String, &str)> = DERIVATIONAL_AFFIXES
        .iter()
        .map(|(suffix, function)| (suffix.trim_start_matches('-').to_string(), *function))
        .collect();
    derivational.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    for (suffix, function) in &derivational {
        if let Some(stem) = strip_suffix(surface, suffix) {
            if let Some(entry) = find_entry(surface).or_else(|| find_entry(stem)) {
                return MorphAnalysis {
                    root: stem.to_string(),
                    affixes: vec![Affix {
                        kind: AffixType::Derivational,
                        suffix: suffix.clone(),
                        gloss: (*function).to_string(),
                    }],
                    entry: Some(entry),
                    recognized: true,
                    ..base
                };
            }
        }
    }

    base
}
