//! Recognising an inflected form of a word the lexicon already has.
//!
//! This is what keeps the coiner honest. Without it the translator invents a
//! brand-new word for "zie" — an inflected form of "zien", which is right
//! there in the dictionary — and the language quietly grows synonyms for
//! vocabulary it already has.
//!
//! The Dutch rules here are the three regular alternations that actually
//! matter, not a claim of complete coverage:
//!
//! - open/closed syllable: `draag` ↔ `dragen`, `loop` ↔ `lopen`, `pak` ↔ `pakken`
//! - final devoicing: `huis` ↔ `huizen`, `wolf` ↔ `wolven`, `lees` ↔ `lezen`
//! - the irregular stems and third-person forms, as explicit tables
//!
//! Candidate ORDER is load-bearing: each lookup returns the first match, so
//! reordering these can resolve a word to a different entry.

use crate::data::lexicon::Entry;
use crate::morphology::closed_class::*;
use crate::morphology::lookup::{find_by_dutch, find_by_english};

/// Which interface language a word is in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    /// English.
    En,
    /// Dutch.
    Nl,
}

impl Lang {
    /// Parses `"en"` / `"nl"`.
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "en" => Some(Self::En),
            "nl" => Some(Self::Nl),
            _ => None,
        }
    }

    /// The two-letter code.
    pub fn code(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::Nl => "nl",
        }
    }
}

const NL_VOWELS: &[char] = &['a', 'e', 'i', 'o', 'u'];
const NL_CONSONANTS: &[char] = &['b', 'c', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];

fn push_unique(out: &mut Vec<String>, candidate: String) {
    if !out.contains(&candidate) {
        out.push(candidate);
    }
}

fn devoice_to_voiced(stem: &str) -> String {
    if let Some(rest) = stem.strip_suffix('s') {
        format!("{rest}z")
    } else if let Some(rest) = stem.strip_suffix('f') {
        format!("{rest}v")
    } else {
        stem.to_string()
    }
}

/// Collapses a doubled vowel before a final consonant run: draag -> drag.
fn collapse_closed_syllable(stem: &str) -> String {
    let chars: Vec<char> = stem.chars().collect();
    // Find the trailing consonant run.
    let mut i = chars.len();
    while i > 0 && NL_CONSONANTS.contains(&chars[i - 1]) {
        i -= 1;
    }
    if i == chars.len() || i < 2 {
        return stem.to_string();
    }
    if chars[i - 1] == chars[i - 2] && NL_VOWELS.contains(&chars[i - 1]) && chars[i - 1] != 'i' {
        let mut out: String = chars[..i - 1].iter().collect();
        out.extend(&chars[i..]);
        return out;
    }
    stem.to_string()
}

/// Collapses a doubled vowel at the very end: "gaa" -> "ga".
fn collapse_open_syllable(stem: &str) -> String {
    let chars: Vec<char> = stem.chars().collect();
    if chars.len() >= 2 {
        let last = chars[chars.len() - 1];
        if last == chars[chars.len() - 2] && NL_VOWELS.contains(&last) && last != 'i' {
            return chars[..chars.len() - 1].iter().collect();
        }
    }
    stem.to_string()
}

/// Infinitives that could produce this present-tense stem, in priority order.
fn dutch_verb_infinitives(stem: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();

    push_unique(&mut out, format!("{stem}en"));
    let dropped: String = {
        let chars: Vec<char> = stem.chars().collect();
        if chars.is_empty() { String::new() } else { chars[..chars.len() - 1].iter().collect() }
    };
    push_unique(&mut out, format!("{dropped}en"));

    for (infinitive, irregular) in NL_IRREGULAR_STEM {
        if *irregular == stem {
            push_unique(&mut out, infinitive.to_string());
        }
    }

    let voiced = devoice_to_voiced(stem);
    if voiced != stem {
        push_unique(&mut out, format!("{voiced}en"));
    }

    let open_collapsed = collapse_open_syllable(stem);
    if open_collapsed != stem {
        push_unique(&mut out, format!("{open_collapsed}en"));
        for (infinitive, irregular) in NL_IRREGULAR_STEM {
            if *irregular == open_collapsed {
                push_unique(&mut out, infinitive.to_string());
            }
        }
    }

    let degeminated = collapse_closed_syllable(stem);
    if degeminated != stem {
        push_unique(&mut out, format!("{degeminated}en"));
        let degeminated_voiced = devoice_to_voiced(&degeminated);
        if degeminated_voiced != degeminated {
            push_unique(&mut out, format!("{degeminated_voiced}en"));
        }
    }

    // Short vowel in an open syllable doubles its consonant: pak -> pakken.
    let chars: Vec<char> = stem.chars().collect();
    if chars.len() >= 2 {
        let last = chars[chars.len() - 1];
        let before = chars[chars.len() - 2];
        if NL_VOWELS.contains(&before) && !NL_VOWELS.contains(&last) {
            push_unique(&mut out, format!("{stem}{last}en"));
        }
    }

    out
}

/// Singular forms a Dutch plural could have come from, in priority order.
fn dutch_noun_singulars(plural: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let chars: Vec<char> = plural.chars().collect();

    if plural.ends_with("en") && chars.len() > 4 {
        let stem: String = chars[..chars.len() - 2].iter().collect();
        push_unique(&mut out, stem.clone());

        // huizen -> huis, wolven -> wolf.
        let devoiced = if let Some(rest) = stem.strip_suffix('z') {
            format!("{rest}s")
        } else if let Some(rest) = stem.strip_suffix('v') {
            format!("{rest}f")
        } else {
            stem.clone()
        };
        push_unique(&mut out, devoiced);

        // mannen -> man.
        let sc: Vec<char> = stem.chars().collect();
        if sc.len() >= 2 && sc[sc.len() - 1] == sc[sc.len() - 2] && NL_CONSONANTS.contains(&sc[sc.len() - 1]) {
            push_unique(&mut out, sc[..sc.len() - 1].iter().collect());
        }

        // dagen -> dag: the vowel was long because the syllable was open.
        if sc.len() >= 2 && NL_VOWELS.contains(&sc[sc.len() - 2]) && NL_CONSONANTS.contains(&sc[sc.len() - 1]) {
            let mut redoubled: String = sc[..sc.len() - 2].iter().collect();
            redoubled.push(sc[sc.len() - 2]);
            redoubled.push(sc[sc.len() - 2]);
            redoubled.push(sc[sc.len() - 1]);
            push_unique(&mut out, redoubled);
        }
    }

    if plural.ends_with('s') && chars.len() > 3 {
        push_unique(&mut out, chars[..chars.len() - 1].iter().collect());
    }

    out
}

/// Strips a plural ending. Returns the base and whether anything was stripped.
pub fn singularize(word: &str, lang: Lang) -> (String, bool) {
    let chars: Vec<char> = word.chars().collect();
    match lang {
        Lang::En => {
            if word.ends_with('s') && chars.len() > 3 {
                return (chars[..chars.len() - 1].iter().collect(), true);
            }
        }
        Lang::Nl => {
            if word.ends_with("en") && chars.len() > 4 {
                return (chars[..chars.len() - 2].iter().collect(), true);
            }
            if word.ends_with('s') && chars.len() > 3 {
                return (chars[..chars.len() - 1].iter().collect(), true);
            }
        }
    }
    (word.to_string(), false)
}

/// Strips a comparative or superlative marker, returning the bare adjective.
pub fn degree_base(word: &str, lang: Lang) -> String {
    let chars: Vec<char> = word.chars().collect();
    match lang {
        Lang::En => {
            if let Some(rest) = word.strip_prefix("most ") {
                return rest.to_string();
            }
            if let Some(rest) = word.strip_prefix("more ") {
                return rest.to_string();
            }
            if word.ends_with("est") && chars.len() > 3 {
                return chars[..chars.len() - 3].iter().collect();
            }
            if word.ends_with("er") && chars.len() > 2 {
                return chars[..chars.len() - 2].iter().collect();
            }
        }
        Lang::Nl => {
            if let Some(rest) = word.strip_prefix("meest ") {
                return rest.to_string();
            }
            if let Some(rest) = word.strip_prefix("meer ") {
                return rest.to_string();
            }
            if word.ends_with("st") && chars.len() > 2 {
                return chars[..chars.len() - 2].iter().collect();
            }
            if word.ends_with("er") && chars.len() > 2 {
                return chars[..chars.len() - 2].iter().collect();
            }
        }
    }
    word.to_string()
}

fn resolve_english_verb(word: &str) -> Option<&'static Entry> {
    let candidates = [
        word.to_string(),
        word.strip_suffix("es").map(str::to_string).unwrap_or_else(|| word.to_string()),
        word.strip_suffix('s').map(str::to_string).unwrap_or_else(|| word.to_string()),
    ];
    for candidate in candidates {
        if let Some(entry) = find_by_english(&candidate) {
            if entry.pos == "verb" || entry.pos == "particle/verb" {
                return Some(entry);
            }
        }
    }
    None
}

/// Resolves one surface word to a lexicon entry, trying every inflection the
/// engine knows. Returns `None` only when the lexicon genuinely has nothing —
/// which is the one case where coining is correct.
pub fn resolve_content_word(word: &str, lang: Lang) -> Option<&'static Entry> {
    let find = |w: &str| match lang {
        Lang::En => find_by_english(w),
        Lang::Nl => find_by_dutch(w),
    };

    if let Some(direct) = find(word) {
        return Some(direct);
    }

    // Copula. Without this the fallback coins a new word for "is", when the
    // language already has "ash".
    let copula_forms = match lang {
        Lang::En => EN_COPULA_FORMS,
        Lang::Nl => NL_COPULA_FORMS,
    };
    if copula_forms.contains(&word) {
        let copula = match lang {
            Lang::En => find_by_english("to be"),
            Lang::Nl => find_by_dutch("zijn"),
        };
        if copula.is_some() {
            return copula;
        }
    }

    // Plural.
    let (base, _) = singularize(word, lang);
    if let Some(singular) = find(&base) {
        return Some(singular);
    }
    if lang == Lang::Nl {
        for candidate in dutch_noun_singulars(word) {
            if let Some(hit) = find_by_dutch(&candidate) {
                return Some(hit);
            }
        }
    }

    // Verb inflection.
    match lang {
        Lang::En => {
            if let Some(as_verb) = resolve_english_verb(word) {
                return Some(as_verb);
            }
            for (infinitive, third) in EN_PRESENT_3SG_IRREGULAR {
                if *third == word {
                    if let Some(entry) = find_by_english(infinitive) {
                        return Some(entry);
                    }
                }
            }
            for (infinitive, past) in EN_PAST_FORMS {
                if *past == word {
                    if let Some(entry) = find_by_english(infinitive) {
                        return Some(entry);
                    }
                }
            }
        }
        Lang::Nl => {
            for (infinitive, third) in NL_PRESENT_3SG_IRREGULAR {
                if *third == word {
                    if let Some(entry) = find_by_dutch(infinitive) {
                        return Some(entry);
                    }
                }
            }
            // The clause parser's candidates plus 2nd/3rd-person -t stripping,
            // so "ziet" reaches "zien".
            let chars: Vec<char> = word.chars().collect();
            let mut stems = vec![word.to_string()];
            if word.ends_with('t') && chars.len() > 2 {
                stems.push(chars[..chars.len() - 1].iter().collect());
            }
            for stem in &stems {
                for infinitive in dutch_verb_infinitives(stem) {
                    if let Some(hit) = find_by_dutch(&infinitive) {
                        return Some(hit);
                    }
                }
            }
            for (infinitive, past) in NL_PAST_FORMS {
                if *past == word {
                    if let Some(entry) = find_by_dutch(infinitive) {
                        return Some(entry);
                    }
                }
            }
        }
    }

    // Comparative / superlative.
    let degree = degree_base(word, lang);
    if degree != word {
        if let Some(adjective) = find(&degree) {
            return Some(adjective);
        }
    }

    None
}
