//! The top-level translator: English and Dutch ⇄ Gurzûl Khar.

use crate::lexicon::{coin, CoinInput, COINER_VERSION};
use crate::morphology::{guess_lemma, lemmatize, Lang, LemmaKind};
use crate::phonology::ipa_of_sentence;
use crate::translator::analyzer::analyze_word;
use crate::translator::model::*;
use crate::translator::natural_tables::*;
use crate::translator::parse_gkh::{consume_np, parse_gkh_clause};
use crate::translator::parse_natural::{consume_natural_np, parse_natural_clause};
use crate::translator::render_gkh::{render_clause_gkh, render_np};
use crate::translator::render_natural::{decapitalize_clause, render_clause_natural, render_np_natural};

/// Which way a translation goes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    /// English to Gurzûl Khar.
    EnToGkh,
    /// Dutch to Gurzûl Khar.
    NlToGkh,
    /// Gurzûl Khar to English.
    GkhToEn,
    /// Gurzûl Khar to Dutch.
    GkhToNl,
}

impl Direction {
    /// Parses `"en-gkh"` and friends.
    pub fn from_code(code: &str) -> Option<Self> {
        Some(match code {
            "en-gkh" => Self::EnToGkh,
            "nl-gkh" => Self::NlToGkh,
            "gkh-en" => Self::GkhToEn,
            "gkh-nl" => Self::GkhToNl,
            _ => return None,
        })
    }

    /// True when the target is Gurzûl Khar.
    pub fn targets_gkh(self) -> bool {
        matches!(self, Self::EnToGkh | Self::NlToGkh)
    }

    /// The interface language involved, whichever side it is on.
    pub fn natural_lang(self) -> Lang {
        match self {
            Self::EnToGkh | Self::GkhToEn => Lang::En,
            Self::NlToGkh | Self::GkhToNl => Lang::Nl,
        }
    }
}

/// A word the coiner supplied because the lexicon had no entry for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinedEntry {
    /// The source-language word.
    pub source: String,
    /// The generated Gurzûl Khar form.
    pub gkh: String,
    /// The coiner version that produced it.
    pub version: &'static str,
}

/// The outcome of a translation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Translation {
    /// A translation was produced.
    Ok(Box<TranslationOk>),
    /// Nothing reliable could be produced.
    Failed {
        /// Why.
        reason: ParseFailure,
    },
}

/// A successful translation.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TranslationOk {
    /// The translated text.
    pub output: String,
    /// IPA for the output, when the target is Gurzûl Khar.
    pub pronunciation: Option<String>,
    /// True when no full grammatical pattern matched and the sentence was
    /// translated word for word.
    pub partial: bool,
    /// Source words the lexicon could not resolve.
    pub unknown_words: Vec<String>,
    /// Words the coiner supplied.
    pub coined_words: Vec<CoinedEntry>,
    /// Notes on what the engine did, for the explanation panel.
    pub transformations: Vec<String>,
}

fn tokenize_sentence(input: &str) -> (bool, Vec<String>) {
    let trimmed = input.trim();
    let is_question = trimmed.ends_with('?');
    let stripped = trimmed.trim_end_matches(['?', '.', '!']);
    let words = stripped
        .split_whitespace()
        .map(|w| {
            w.trim_matches(|c: char| ",;:\"'()[]".contains(c)).to_lowercase()
        })
        .filter(|w| !w.is_empty())
        .collect();
    (is_question, words)
}

fn coord_table(lang: Lang) -> &'static [(&'static str, &'static str)] {
    match lang {
        Lang::En => EN_COORD,
        Lang::Nl => NL_COORD,
    }
}

/// Finds a top-level conjunction, never at the very start or end.
fn split_on_coordination(words: &[String], lang: Lang) -> Option<(Vec<String>, &'static str, Vec<String>)> {
    for i in 1..words.len().saturating_sub(1) {
        if let Some((_, gkh)) = coord_table(lang).iter().find(|(w, _)| *w == words[i]) {
            return Some((words[..i].to_vec(), gkh, words[i + 1..].to_vec()));
        }
    }
    None
}

/// Dutch puts the verb at the END of a subordinate clause. Rather than teach
/// the parser a second word order, the clause is normalised back to SVO: a
/// clause-final verb moves to just after the subject.
fn unwind_dutch_verb_final(words: &[String]) -> Option<Vec<String>> {
    if words.len() < 3 {
        return None;
    }
    let last = words.last()?;
    let is_verb = crate::morphology::resolve_content_word(last, Lang::Nl)
        .map(|e| e.pos == "verb" || e.pos == "particle/verb")
        .unwrap_or(false);
    let is_copula = NL_COPULA_WORDS.contains(&last.as_str());
    if !is_verb && !is_copula {
        return None;
    }

    // The verb belongs after the SUBJECT, not after the first token.
    let rest = &words[..words.len() - 1];
    let (_, remaining) = consume_natural_np(rest, Lang::Nl).ok()?;
    let subject_len = rest.len() - remaining.len();
    if subject_len == 0 {
        return None;
    }

    let mut out: Vec<String> = rest[..subject_len].to_vec();
    out.push(last.clone());
    out.extend_from_slice(&rest[subject_len..]);
    Some(out)
}

/// Finds the first subordinator that genuinely splits the sentence.
fn find_subordinator(words: &[String], lang: Lang) -> Option<(usize, &'static str, &'static str)> {
    let mut best: Option<(usize, &'static str, &'static str)> = None;
    for (gkh, en, nl, label) in SUBORDINATORS {
        let surfaces: Vec<&str> = match lang {
            Lang::En => vec![*en],
            Lang::Nl => nl.to_vec(),
        };
        for surface in surfaces {
            if let Some(idx) = words.iter().position(|w| w == surface) {
                if idx == 0 || idx >= words.len() - 1 {
                    continue;
                }
                // "that" / "dat" is both complementiser and relativiser. After
                // a NOUN it introduces a relative clause and the noun-phrase
                // parser handles it; after a verb it is the complementiser.
                if surface == "that" || surface == "dat" {
                    if let Some(preceding) = crate::morphology::resolve_content_word(&words[idx - 1], lang) {
                        if preceding.pos == "noun" {
                            continue;
                        }
                    }
                }
                if best.map(|(b, _, _)| idx < b).unwrap_or(true) {
                    best = Some((idx, gkh, label));
                }
            }
        }
    }
    best
}

/// Word-for-word fallback into Gurzûl Khar.
///
/// Every lexicon route runs first — a direct hit, an inflected form, a
/// compound built from known roots. Coining is tier four and tier four only,
/// or the translator invents synonyms for words it already has.
fn partial_to_gkh(words: &[String], lang: Lang) -> (Vec<String>, Vec<String>, Vec<CoinedEntry>) {
    let mut unknown = Vec::new();
    let mut coined = Vec::new();
    let mut taken: Vec<String> = Vec::new();
    let articles = match lang {
        Lang::En => EN_ARTICLES,
        Lang::Nl => NL_ARTICLES,
    };

    let output = words
        .iter()
        .filter(|w| !articles.contains(&w.as_str()))
        .map(|w| {
            if let Some(lemma) = lemmatize(w, lang) {
                if lemma.kind == LemmaKind::Compound {
                    // Built from roots the lexicon already has.
                }
                return lemma.gkh;
            }
            unknown.push(w.clone());
            // Seed on the guessed dictionary form, never the surface form, so
            // "huis" and "huizen" get one word rather than two.
            let lemma_guess = guess_lemma(w, lang);
            let input = CoinInput {
                lemma: lemma_guess,
                pos: "unknown".to_string(),
                lang: lang.code().to_string(),
            };
            match coin(&input, &taken) {
                Ok(result) => {
                    taken.push(result.gkh.clone());
                    coined.push(CoinedEntry {
                        source: w.clone(),
                        gkh: result.gkh.clone(),
                        version: COINER_VERSION,
                    });
                    result.gkh
                }
                Err(_) => format!("⟦{w}⟧"),
            }
        })
        .collect();

    (output, unknown, coined)
}

/// Word-for-word fallback out of Gurzûl Khar.
fn partial_to_natural(words: &[String], lang: Lang) -> (Vec<String>, Vec<String>) {
    let mut unknown = Vec::new();
    let output = words
        .iter()
        .map(|w| {
            let analysis = analyze_word(w);
            let entry = analysis.entry.or_else(|| crate::morphology::find_by_gkh(w));
            if let Some(entry) = entry {
                let gloss = match lang {
                    Lang::En => entry.en,
                    Lang::Nl => entry.nl,
                };
                // Glosses carry alternatives; a translation picks one rather
                // than printing the dictionary entry at the reader.
                return gloss.split('/').next().unwrap_or(gloss).trim().to_string();
            }
            unknown.push(w.clone());
            format!("⟦{w}⟧")
        })
        .collect();
    (output, unknown)
}

fn to_gkh(input: &str, lang: Lang) -> Translation {
    let (is_question, words) = tokenize_sentence(input);
    if words.is_empty() {
        return Translation::Failed { reason: ParseFailure::EmptyInput };
    }

    let mut transformations = Vec::new();

    // Why the structured parse failed decides what happens next: an unknown
    // WORD is translated word for word, because the rest of the sentence is
    // still useful and nothing should be dropped. An unsupported PATTERN is
    // refused outright — every word is known, so a word-for-word gloss would
    // look like a translation while quietly losing the grammar.
    let mut last_failure: Option<ParseFailure> = None;
    let mut note = |f: ParseFailure| -> Option<Vec<String>> {
        last_failure = Some(f);
        None
    };

    let tokens: Option<Vec<String>> = (|| {
        // A complex sentence: [main] [subordinator] [subordinate].
        if let Some((idx, gkh, label)) = find_subordinator(&words, lang) {
            let main = parse_natural_clause(&words[..idx], lang, false).ok()?;
            let sub_words = words[idx + 1..].to_vec();
            let sub = match parse_natural_clause(&sub_words, lang, is_question) {
                Ok(c) => c,
                Err(_) if lang == Lang::Nl => {
                    let svo = unwind_dutch_verb_final(&sub_words)?;
                    transformations.push(format!(
                        "Dutch subordinate clauses are verb-final (\"{}\"); normalised to SVO before parsing.",
                        sub_words.join(" ")
                    ));
                    parse_natural_clause(&svo, lang, is_question).ok()?
                }
                Err(_) => return None,
            };
            transformations.push(format!(
                "Parsed as a complex sentence: main clause + {label} subordinator \"{gkh}\" + subordinate clause."
            ));
            let mut out = render_clause_gkh(&main);
            out.push(gkh.to_string());
            out.extend(render_clause_gkh(&sub));
            return Some(out);
        }

        // Two coordinated clauses.
        if let Some((left_words, marker, right_words)) = split_on_coordination(&words, lang) {
            let left = parse_natural_clause(&left_words, lang, false).ok()?;
            let right = parse_natural_clause(&right_words, lang, is_question).ok()?;
            transformations.push(format!("Parsed as two coordinated clauses joined by \"{marker}\"."));
            let mut out = render_clause_gkh(&left);
            out.push(marker.to_string());
            out.extend(render_clause_gkh(&right));
            return Some(out);
        }

        // A standalone noun phrase, with no verb at all.
        if let Ok((np, rest)) = consume_natural_np(&words, lang) {
            if rest.is_empty() {
                transformations.push("Parsed as a standalone noun phrase (no verb).".to_string());
                return Some(render_np(&np));
            }
        }

        match parse_natural_clause(&words, lang, is_question) {
            Ok(clause) => Some(render_clause_gkh(&clause)),
            Err(f) => note(f),
        }
    })();

    match tokens {
        Some(tokens) => {
            let output = tokens.join(" ");
            let pronunciation = Some(ipa_of_sentence(&output));
            Translation::Ok(Box::new(TranslationOk {
                output,
                pronunciation,
                transformations,
                ..TranslationOk::default()
            }))
        }
        None => {
            // Only an unknown word earns the word-for-word fallback.
            match &last_failure {
                Some(ParseFailure::UnknownWord(_)) | None => {}
                Some(other) => return Translation::Failed { reason: other.clone() },
            }
            let (out_words, unknown, coined) = partial_to_gkh(&words, lang);
            if out_words.is_empty() {
                return Translation::Failed { reason: ParseFailure::UnsupportedPattern };
            }
            let output = out_words.join(" ");
            let mut transformations = transformations;
            transformations.push(
                "No supported grammatical pattern matched, so each word was translated on its own; \
                 tense, plural and word order were not reliably applied."
                    .to_string(),
            );
            if !coined.is_empty() {
                transformations.push(format!(
                    "No lexicon entry for {}, so coiner_{COINER_VERSION} supplied a form.",
                    coined.iter().map(|c| format!("\"{}\"", c.source)).collect::<Vec<_>>().join(", ")
                ));
            }
            let pronunciation = Some(ipa_of_sentence(&output));
            Translation::Ok(Box::new(TranslationOk {
                output,
                pronunciation,
                partial: true,
                unknown_words: unknown,
                coined_words: coined,
                transformations,
            }))
        }
    }
}

fn to_natural(input: &str, lang: Lang) -> Translation {
    let (_, words) = tokenize_sentence(input);
    if words.is_empty() {
        return Translation::Failed { reason: ParseFailure::EmptyInput };
    }

    let mut transformations = Vec::new();

    let mut last_failure: Option<ParseFailure> = None;
    let mut note = |f: ParseFailure| -> Option<String> {
        last_failure = Some(f);
        None
    };

    let sentence: Option<String> = (|| {
        // A complex sentence.
        let hit = SUBORDINATORS
            .iter()
            .filter_map(|(gkh, en, nl, _)| words.iter().position(|w| w == gkh).map(|idx| (idx, *en, *nl)))
            .filter(|(idx, _, _)| *idx > 0)
            .min_by_key(|(idx, _, _)| *idx);

        if let Some((idx, en, nl)) = hit {
            let main = parse_gkh_clause(&words[..idx]).ok()?;
            let sub = parse_gkh_clause(&words[idx + 1..]).ok()?;
            transformations
                .push("Parsed as a complex sentence: main clause + subordinator + subordinate clause.".to_string());
            let joiner = match lang {
                Lang::En => en,
                Lang::Nl => nl[0],
            };
            let main_text = decapitalize_clause(&render_clause_natural(&main, lang, false));
            // Dutch subordinate clauses are verb-final; English ones are not.
            let sub_text = decapitalize_clause(&render_clause_natural(&sub, lang, true));
            let mut chars = main_text.chars();
            let capitalised = match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => main_text.clone(),
            };
            return Some(format!("{capitalised} {joiner} {sub_text}."));
        }

        // Coordination.
        for i in 1..words.len().saturating_sub(1) {
            let marker = words[i].as_str();
            let joiner = match (marker, lang) {
                ("ag", Lang::En) => Some("and"),
                ("vo", Lang::En) => Some("or"),
                ("nâth", Lang::En) => Some("but"),
                ("ag", Lang::Nl) => Some("en"),
                ("vo", Lang::Nl) => Some("of"),
                ("nâth", Lang::Nl) => Some("maar"),
                _ => None,
            };
            if let Some(joiner) = joiner {
                let left = parse_gkh_clause(&words[..i]).ok()?;
                let right = parse_gkh_clause(&words[i + 1..]).ok()?;
                transformations.push(format!("Parsed as two coordinated clauses joined by \"{marker}\"."));
                let left_text = render_clause_natural(&left, lang, false);
                let right_text = decapitalize_clause(&render_clause_natural(&right, lang, false));
                return Some(format!("{} {joiner} {right_text}.", left_text.trim_end_matches('.')));
            }
        }

        // A standalone noun phrase.
        if let Ok((np, rest)) = consume_np(&words) {
            if rest.is_empty() {
                transformations.push("Parsed as a standalone noun phrase (no verb).".to_string());
                return Some(render_np_natural(&np, lang, !np.is_pronoun));
            }
        }

        match parse_gkh_clause(&words) {
            Ok(clause) => Some(render_clause_natural(&clause, lang, false)),
            Err(f) => note(f),
        }
    })();

    match sentence {
        Some(output) => Translation::Ok(Box::new(TranslationOk {
            output,
            pronunciation: Some(ipa_of_sentence(input)),
            transformations,
            ..TranslationOk::default()
        })),
        None => {
            match &last_failure {
                Some(ParseFailure::UnknownWord(_)) | None => {}
                Some(other) => return Translation::Failed { reason: other.clone() },
            }
            let (out_words, unknown) = partial_to_natural(&words, lang);
            if out_words.is_empty() {
                return Translation::Failed { reason: ParseFailure::UnsupportedPattern };
            }
            transformations.push(
                "No supported grammatical pattern matched, so each word was translated on its own."
                    .to_string(),
            );
            Translation::Ok(Box::new(TranslationOk {
                output: out_words.join(" "),
                pronunciation: Some(ipa_of_sentence(input)),
                partial: true,
                unknown_words: unknown,
                transformations,
                ..TranslationOk::default()
            }))
        }
    }
}

/// Translates one sentence.
///
/// A sentence that matches no supported pattern comes back word for word with
/// `partial` set, rather than being refused or guessed at — nothing is
/// dropped, and the caller is told what happened.
pub fn translate(input: &str, direction: Direction) -> Translation {
    if direction.targets_gkh() {
        to_gkh(input, direction.natural_lang())
    } else {
        to_natural(input, direction.natural_lang())
    }
}

