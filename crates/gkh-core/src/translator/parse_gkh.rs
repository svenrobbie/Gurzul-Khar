//! Parsing Gurzûl Khar into the clause model.
//!
//! The mirror of `render_gkh`. Anything the renderer can produce, this has to
//! be able to read back, or the four translation directions stop agreeing.

use crate::data::grammar::*;
use crate::data::lexicon::ENTRIES;
use crate::data::table_key_of;
use crate::translator::analyzer::{analyze_word, AffixType};
use crate::translator::model::*;

/// Postposition spellings, read from the lexicon so a renamed entry needs no
/// code change. `ta` is excluded: it marks possession inside a noun phrase,
/// not an adjunct.
fn postpositions() -> Vec<&'static str> {
    ENTRIES
        .iter()
        .filter(|e| e.pos == "postposition" && e.gkh != POSSESSION_MARKER)
        .map(|e| e.gkh)
        .collect()
}

/// Modal roots. Analytic modals take the tense and leave the main verb bare.
const MODAL_ROOTS: &[&str] = &["dâk", "mâg"];

fn person_of_subject_form(form: &str) -> Option<Person> {
    table_key_of(SUBJECT_FORMS, form).and_then(Person::from_key)
}

/// Consumes a noun phrase from the front of `tokens`.
pub fn consume_np(tokens: &[String]) -> Result<(Np, Vec<String>), ParseFailure> {
    if tokens.is_empty() {
        return Err(ParseFailure::UnsupportedPattern);
    }
    let head = &tokens[0];
    let mut rest: Vec<String> = tokens[1..].to_vec();

    // A pronoun, optionally possessed.
    if let Some(person) = person_of_subject_form(head) {
        let mut np = Np::pronoun(person, head.clone());
        if rest.first().map(String::as_str) == Some(POSSESSION_MARKER) {
            let (possessor, remaining) = consume_np(&rest[1..])?;
            np.possessive = Some(Possessive::Postposition(Box::new(possessor)));
            rest = remaining;
        }
        return Ok((np, rest));
    }

    let analysis = analyze_word(head);
    if !analysis.recognized {
        return Err(ParseFailure::UnknownWord(head.clone()));
    }

    let mut np = Np::noun(analysis.root.clone(), analysis.entry);
    if analysis.affixes.iter().any(|a| a.kind == AffixType::Plural) {
        np.plural = true;
    }
    if let Some(poss) = analysis.affixes.iter().find(|a| a.kind == AffixType::Possessive) {
        if let Some(person) = table_key_of(POSSESSIVE_SUFFIXES, &poss.suffix).and_then(Person::from_key) {
            np.possessive = Some(Possessive::Suffix(person));
        }
    }

    // An adjective directly after the noun: [ghâr]? [zan]? ADJ[-gûl]?
    let mut i = 0usize;
    let mut intensified = false;
    let mut degree = Degree::Plain;
    if rest.get(i).map(String::as_str) == Some(INTENSIFIER) {
        intensified = true;
        i += 1;
    }
    if rest.get(i).map(String::as_str) == Some(COMPARATIVE_MARKER) {
        degree = Degree::Comparative;
        i += 1;
    }
    if let Some(candidate) = rest.get(i).cloned() {
        let candidate_base = if degree == Degree::Comparative && candidate.ends_with(SUPERLATIVE_SUFFIX) {
            candidate[..candidate.len() - SUPERLATIVE_SUFFIX.len()].to_string()
        } else {
            candidate.clone()
        };
        let adj_entry = ENTRIES
            .iter()
            .find(|e| e.gkh.to_lowercase() == candidate_base.to_lowercase() && e.pos == "adjective");
        if let Some(entry) = adj_entry {
            let mut root = candidate.clone();
            let mut final_degree = degree;
            if degree == Degree::Comparative && root.ends_with(SUPERLATIVE_SUFFIX) {
                final_degree = Degree::Superlative;
                root = root[..root.len() - SUPERLATIVE_SUFFIX.len()].to_string();
            }
            np.adjective = Some(AdjectivePhrase {
                root,
                entry: Some(entry),
                degree: final_degree,
                intensified,
            });
            rest = rest[i + 1..].to_vec();
        }
    }

    if rest.first().map(String::as_str) == Some(POSSESSION_MARKER) {
        let (possessor, remaining) = consume_np(&rest[1..])?;
        np.possessive = Some(Possessive::Postposition(Box::new(possessor)));
        rest = remaining;
    }

    // A subject-gap relative clause: [head] kha [object] [verb].
    if rest.first().map(String::as_str) == Some(RELATIVISER) && rest.len() >= 2 {
        let inner = rest[1..].to_vec();
        // The verb closes the relative clause; everything before it is its object.
        let verb_idx = inner.iter().position(|w| {
            let a = analyze_word(w);
            a.recognized && matches!(a.entry.map(|e| e.pos), Some("verb") | Some("particle/verb"))
        });

        if let Some(idx) = verb_idx {
            let rel_analysis = analyze_word(&inner[idx]);
            let tense = rel_analysis
                .affixes
                .iter()
                .find(|a| a.kind == AffixType::Tense)
                .and_then(|a| table_key_of(TENSE_SUFFIXES, &a.suffix))
                .map(|k| match k {
                    "past" => Tense::Past,
                    "future" => Tense::Future,
                    _ => Tense::Present,
                })
                .unwrap_or(Tense::Present);

            let object_tokens = &inner[..idx];
            let object = if object_tokens.is_empty() {
                None
            } else {
                let (obj, remaining) = consume_np(object_tokens)?;
                if !remaining.is_empty() {
                    return Err(ParseFailure::UnsupportedPattern);
                }
                Some(obj)
            };

            np.relative = Some(Box::new(RelativeClause {
                verb: VerbPhrase {
                    root: rel_analysis.root.clone(),
                    tense,
                    is_copula: false,
                    entry: rel_analysis.entry,
                },
                object,
            }));
            rest = inner[idx + 1..].to_vec();
        }
    }

    Ok((np, rest))
}

/// Parses a sequence of Gurzûl Khar tokens into one clause.
pub fn parse_gkh_clause(tokens: &[String]) -> Result<Clause, ParseFailure> {
    let mut t: Vec<String> = tokens.to_vec();

    let mut question_yes_no = false;
    if t.last().map(String::as_str) == Some(QUESTION_PARTICLE) {
        question_yes_no = true;
        t.pop();
    }

    let mut question_word = None;
    if let Some(first) = t.first() {
        if let Some(key) = table_key_of(INTERROGATIVES, first) {
            question_word = QuestionWord::from_key(key);
            if question_word.is_some() {
                t.remove(0);
            }
        }
    }

    let mut negate = false;
    if let Some(pos) = t.iter().position(|w| w == NEGATION_PARTICLE) {
        negate = true;
        t.remove(pos);
    }

    // A clause-final postposition takes the noun phrase immediately before it.
    // Longest first so a possessive adjunct stays whole, and never at the cost
    // of leaving the clause without a verb.
    let mut postpositional = None;
    if let Some(last) = t.last().cloned() {
        if postpositions().contains(&last.as_str()) {
            let before = t[..t.len() - 1].to_vec();
            for span in (1..=before.len().min(3)).rev() {
                if before.len() - span < 1 {
                    continue;
                }
                let candidate = &before[before.len() - span..];
                if let Ok((np, remaining)) = consume_np(candidate) {
                    if remaining.is_empty() {
                        postpositional = Some(PostpositionalPhrase { np, postposition: last.clone() });
                        t = before[..before.len() - span].to_vec();
                        break;
                    }
                }
            }
        }
    }

    // An imperative opens with a BARE verb root and has no subject. Checked
    // before the subject is consumed, or "pâk durang dûl" parses pâk as a noun.
    if !question_yes_no && question_word.is_none() && !t.is_empty() {
        let head = analyze_word(&t[0]);
        let bare = head.recognized && head.affixes.is_empty() && head.root == t[0];
        if bare && matches!(head.entry.map(|e| e.pos), Some("verb") | Some("particle/verb")) {
            let rest = t[1..].to_vec();
            let object = if rest.is_empty() {
                None
            } else {
                let (obj, remaining) = consume_np(&rest)?;
                if !remaining.is_empty() {
                    return Err(ParseFailure::UnsupportedPattern);
                }
                Some(obj)
            };
            return Ok(Clause {
                imperative: true,
                negate,
                postpositional,
                verb: Some(VerbPhrase {
                    root: head.root.clone(),
                    tense: Tense::Present,
                    is_copula: false,
                    entry: head.entry,
                }),
                object,
                ..Clause::default()
            });
        }
    }

    // Subject: the question word itself, or the first noun phrase.
    let mut question_role = None;
    let mut subject = None;
    let mut rest = t;

    if question_word.is_some() {
        let first_is_verb = rest
            .first()
            .map(|w| analyze_word(w))
            .map(|a| matches!(a.entry.map(|e| e.pos), Some("verb") | Some("particle/verb")))
            .unwrap_or(false);
        if first_is_verb {
            question_role = Some(QuestionRole::Subject);
        } else {
            let (np, remaining) = consume_np(&rest)?;
            subject = Some(np);
            rest = remaining;
        }
    } else {
        let (np, remaining) = consume_np(&rest)?;
        subject = Some(np);
        rest = remaining;
    }

    if rest.is_empty() {
        return Err(ParseFailure::UnsupportedPattern);
    }

    let verb_surface = rest[0].clone();
    let verb_analysis = analyze_word(&verb_surface);
    if !verb_analysis.recognized {
        return Err(ParseFailure::UnknownWord(verb_surface));
    }

    let is_copula = verb_analysis.root == "ash";
    let tense = if let Some(affix) = verb_analysis.affixes.iter().find(|a| a.kind == AffixType::Tense) {
        match table_key_of(TENSE_SUFFIXES, &affix.suffix) {
            Some("past") => Tense::Past,
            Some("future") => Tense::Future,
            _ => Tense::Present,
        }
    } else if is_copula {
        match verb_surface.as_str() {
            "ashak" => Tense::Past,
            "ashâth" => Tense::Future,
            _ => Tense::Present,
        }
    } else {
        Tense::Present
    };
    rest = rest[1..].to_vec();

    let mut verb = VerbPhrase {
        root: verb_analysis.root.clone(),
        tense,
        is_copula,
        entry: verb_analysis.entry,
    };

    // Modal + bare main verb: the modal carried the tense, so hand it over.
    let mut modal = None;
    if MODAL_ROOTS.contains(&verb_analysis.root.as_str()) && !rest.is_empty() {
        let main = analyze_word(&rest[0]);
        if main.recognized && matches!(main.entry.map(|e| e.pos), Some("verb") | Some("particle/verb")) {
            modal = Some(VerbPhrase {
                root: verb_analysis.root.clone(),
                tense,
                is_copula: false,
                entry: verb_analysis.entry,
            });
            verb = VerbPhrase {
                root: main.root.clone(),
                tense,
                is_copula: false,
                entry: main.entry,
            };
            rest = rest[1..].to_vec();
        }
    }

    if question_word.is_none() && rest.is_empty() {
        return Ok(Clause {
            negate,
            question_yes_no,
            question_word,
            question_role,
            subject,
            verb: Some(verb),
            modal,
            postpositional,
            ..Clause::default()
        });
    }

    // Predicate adjective after the copula: [ghâr]? [zan]? ADJ[-gûl]?
    if is_copula && !rest.is_empty() {
        let mut i = 0usize;
        let mut intensified = false;
        let mut degree = Degree::Plain;
        if rest.get(i).map(String::as_str) == Some(INTENSIFIER) {
            intensified = true;
            i += 1;
        }
        if rest.get(i).map(String::as_str) == Some(COMPARATIVE_MARKER) {
            degree = Degree::Comparative;
            i += 1;
        }
        if let Some(candidate) = rest.get(i).cloned() {
            let mut root = candidate.clone();
            let mut final_degree = degree;
            if degree == Degree::Comparative && root.ends_with(SUPERLATIVE_SUFFIX) {
                final_degree = Degree::Superlative;
                root = root[..root.len() - SUPERLATIVE_SUFFIX.len()].to_string();
            }
            let adj_entry = ENTRIES
                .iter()
                .find(|e| e.gkh.to_lowercase() == root.to_lowercase() && e.pos == "adjective");
            if adj_entry.is_some() || degree != Degree::Plain {
                return Ok(Clause {
                    negate,
                    question_yes_no,
                    question_word,
                    question_role,
                    subject,
                    verb: Some(verb),
                    modal,
                    postpositional,
                    predicate_adjective: Some(AdjectivePhrase {
                        root,
                        entry: adj_entry,
                        degree: final_degree,
                        intensified,
                    }),
                    ..Clause::default()
                });
            }
        }
    }

    let mut object = None;
    if !rest.is_empty() {
        let (np, remaining) = consume_np(&rest)?;
        if !remaining.is_empty() {
            return Err(ParseFailure::UnsupportedPattern);
        }
        object = Some(np);
    } else if question_word.is_some() && question_role.is_none() {
        question_role = Some(QuestionRole::Object);
    }

    Ok(Clause {
        negate,
        question_yes_no,
        question_word,
        question_role,
        subject,
        verb: Some(verb),
        object,
        modal,
        postpositional,
        ..Clause::default()
    })
}
