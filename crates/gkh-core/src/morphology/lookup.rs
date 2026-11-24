//! Finding a word in the hand-authored lexicon.

use crate::data::lexicon::{Entry, ENTRIES};

/// Splits a gloss field into the individual surface forms it can match.
///
/// Lexicon glosses carry alternatives and qualifiers: `"he/she/it"`,
/// `"you (pl.)"`, `"dit/deze"`. Parentheticals are dropped and the rest split
/// on slashes and commas, so each alternative is matchable on its own.
fn variants(field: &str) -> Vec<String> {
    let lowered = field.to_lowercase();

    // Drop parentheticals.
    let mut without_parens = String::with_capacity(lowered.len());
    let mut depth = 0usize;
    for ch in lowered.chars() {
        match ch {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            _ if depth == 0 => without_parens.push(ch),
            _ => {}
        }
    }

    without_parens
        .split(['/', ','])
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn strip_to(word: &str) -> String {
    // "to go" and "go" are the same verb.
    word.strip_prefix("to ").unwrap_or(word).trim_start().to_string()
}

/// Finds an entry by its English gloss.
pub fn find_by_english(word: &str) -> Option<&'static Entry> {
    let w = strip_to(&word.to_lowercase());

    ENTRIES
        .iter()
        .find(|e| variants(e.en).contains(&w))
        .or_else(|| ENTRIES.iter().find(|e| variants(&strip_to(&e.en.to_lowercase())).contains(&w)))
}

/// Finds an entry by its Dutch gloss.
pub fn find_by_dutch(word: &str) -> Option<&'static Entry> {
    let w = word.to_lowercase();
    ENTRIES.iter().find(|e| variants(e.nl).contains(&w))
}

/// Finds an entry by its Gurzûl Khar spelling.
pub fn find_by_gkh(word: &str) -> Option<&'static Entry> {
    let w = word.to_lowercase();
    ENTRIES.iter().find(|e| e.gkh.to_lowercase() == w)
}

/// Finds an entry by spelling, restricted to one part of speech.
///
/// The lexicon reuses a spelling across parts of speech — `khar` is at once
/// the noun "strength", the verb "to be strong" and the adjective "strong" —
/// so a caller that knows which it needs must say so.
pub fn find_by_gkh_and_pos(gkh: &str, pos: &str) -> Option<&'static Entry> {
    let w = gkh.to_lowercase();
    ENTRIES.iter().find(|e| e.gkh.to_lowercase() == w && e.pos == pos)
}
