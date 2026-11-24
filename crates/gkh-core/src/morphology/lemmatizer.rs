//! Tiers 2 and 3 of word coverage: resolve a word through the lexicon and its
//! own rules BEFORE the coiner is ever asked.
//!
//! Tier 3 is where Dutch pays off. "nachtwacht" is not a vocabulary gap — it
//! is "nacht" + "wacht", both already in the lexicon, and Gurzûl Khar builds
//! compounds the same way Dutch does: modifier first, head last, roots joined
//! directly (`grammar.json` nouns.compounding, ghûl + dor = ghûldor). The right
//! answer is a real compound of real words, not a coinage that merely looks
//! like one.

use crate::data::lexicon::Entry;
use crate::morphology::inflection::{resolve_content_word, Lang};
use crate::phonology::check_word_phonotactics;

/// How a word was resolved.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LemmaKind {
    /// The surface form is itself the dictionary form.
    Direct,
    /// Resolved through an inflection rule.
    Inflected,
    /// Built from lexicon roots, modifier first.
    Compound,
}

/// One part of a compound.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompoundPart {
    /// The source-language substring this part came from.
    pub surface: String,
    /// The entry it resolved to.
    pub entry: &'static Entry,
}

/// A resolved word.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LemmaResult {
    /// How it was resolved.
    pub kind: LemmaKind,
    /// The Gurzûl Khar form.
    pub gkh: String,
    /// The entry, for a direct or inflected hit.
    pub entry: Option<&'static Entry>,
    /// The parts, for a compound: modifier first, head last.
    pub parts: Vec<CompoundPart>,
    /// True when a built compound breaks the documented phonotactics.
    /// Reported rather than hidden.
    pub phonotactically_irregular: bool,
}

/// Linking elements Dutch inserts between compound members.
const NL_LINKERS: &[&str] = &["", "s", "en", "e", "er"];
/// English inserts almost nothing.
const EN_LINKERS: &[&str] = &["", "s"];

/// Shortest part worth trusting. Below this almost anything matches something
/// and compounds turn to nonsense.
const MIN_PART: usize = 3;
/// More than three members is far more likely a bad split than a real word.
const MAX_PARTS: usize = 3;

fn root_of(entry: &Entry) -> String {
    entry.root.unwrap_or(entry.gkh).replace('-', "")
}

/// Splits a word into lexicon-resolvable parts, left to right.
///
/// Longest head first, so "nachtwacht" is nacht+wacht and never na+cht+wacht.
fn split_compound(word: &str, lang: Lang, depth: usize) -> Option<Vec<CompoundPart>> {
    if depth > MAX_PARTS {
        return None;
    }
    let linkers = match lang {
        Lang::Nl => NL_LINKERS,
        Lang::En => EN_LINKERS,
    };

    let chars: Vec<char> = word.chars().collect();
    if chars.len() < MIN_PART * 2 {
        return None;
    }

    let mut cut = chars.len().saturating_sub(MIN_PART);
    while cut >= MIN_PART {
        let head: String = chars[..cut].iter().collect();
        if let Some(head_entry) = resolve_content_word(&head, lang) {
            for linker in linkers {
                let rest: String = chars[cut..].iter().collect();
                if !rest.starts_with(linker) {
                    continue;
                }
                let tail = &rest[linker.len()..];
                if tail.chars().count() < MIN_PART {
                    continue;
                }

                if let Some(tail_entry) = resolve_content_word(tail, lang) {
                    return Some(vec![
                        CompoundPart { surface: head.clone(), entry: head_entry },
                        CompoundPart { surface: tail.to_string(), entry: tail_entry },
                    ]);
                }

                if let Some(mut deeper) = split_compound(tail, lang, depth + 1) {
                    let mut parts = vec![CompoundPart { surface: head.clone(), entry: head_entry }];
                    parts.append(&mut deeper);
                    return Some(parts);
                }
            }
        }
        cut -= 1;
    }

    None
}

fn build_compound(parts: Vec<CompoundPart>) -> LemmaResult {
    // Modifier + head, head-final, roots joined directly. Dutch and English
    // are head-final too, so source order carries over.
    let gkh: String = parts.iter().map(|p| root_of(p.entry)).collect();
    let irregular = !check_word_phonotactics(&gkh).is_empty();
    LemmaResult {
        kind: LemmaKind::Compound,
        gkh,
        entry: None,
        parts,
        phonotactically_irregular: irregular,
    }
}

/// Resolves one source-language word without inventing anything.
///
/// `None` means the lexicon genuinely cannot account for the word — and that,
/// only that, is when the caller should coin.
pub fn lemmatize(word: &str, lang: Lang) -> Option<LemmaResult> {
    let clean: String = word
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();
    if clean.is_empty() {
        return None;
    }

    if let Some(direct) = resolve_content_word(&clean, lang) {
        let gloss = match lang {
            Lang::En => direct.en,
            Lang::Nl => direct.nl,
        };
        let surface_matches = gloss
            .to_lowercase()
            .split('/')
            .any(|v| v.trim() == clean);
        return Some(LemmaResult {
            kind: if surface_matches { LemmaKind::Direct } else { LemmaKind::Inflected },
            gkh: direct.gkh.to_string(),
            entry: Some(direct),
            parts: Vec::new(),
            phonotactically_irregular: false,
        });
    }

    // A hyphenated source compound is already split for us.
    if clean.contains('-') {
        let pieces: Vec<&str> = clean.split('-').filter(|p| !p.is_empty()).collect();
        if pieces.len() > 1 {
            let resolved: Vec<Option<&'static Entry>> =
                pieces.iter().map(|p| resolve_content_word(p, lang)).collect();
            if resolved.iter().all(Option::is_some) {
                let parts = pieces
                    .iter()
                    .zip(resolved)
                    .map(|(surface, entry)| CompoundPart {
                        surface: (*surface).to_string(),
                        entry: entry.expect("checked above"),
                    })
                    .collect();
                return Some(build_compound(parts));
            }
        }
    }

    split_compound(&clean, lang, 1).map(build_compound)
}

/// Best-guess dictionary form for a word the lexicon cannot account for.
///
/// This exists for one reason: the coiner seeds on the lemma, so without it
/// "huis" and "huizen" would be given two unrelated words for one thing.
/// Deliberately conservative — a wrong strip costs one slightly-off lemma,
/// while an over-eager one merges words that are genuinely different.
pub fn guess_lemma(word: &str, lang: Lang) -> String {
    let w = word.to_lowercase();
    let chars: Vec<char> = w.chars().collect();
    let n = chars.len();

    match lang {
        Lang::Nl => {
            if w.ends_with("en") && n > 5 {
                return chars[..n - 2].iter().collect();
            }
            if w.ends_with('s') && n > 4 {
                return chars[..n - 1].iter().collect();
            }
        }
        Lang::En => {
            if w.ends_with("ies") && n > 5 {
                let mut out: String = chars[..n - 3].iter().collect();
                out.push('y');
                return out;
            }
            if w.ends_with("es") && n > 5 {
                return chars[..n - 2].iter().collect();
            }
            if w.ends_with('s') && !w.ends_with("ss") && n > 4 {
                return chars[..n - 1].iter().collect();
            }
        }
    }
    w
}
