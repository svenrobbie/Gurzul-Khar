//! Parsing English and Dutch into the clause model.

use crate::data::lexicon::Entry;
use crate::morphology::{degree_base, resolve_content_word, singularize, Lang};
use crate::morphology::{find_by_dutch, find_by_english};
use crate::translator::model::*;
use crate::translator::natural_tables::*;

fn articles(lang: Lang) -> &'static [&'static str] {
    match lang {
        Lang::En => EN_ARTICLES,
        Lang::Nl => NL_ARTICLES,
    }
}

fn strip_article(tokens: &[String], lang: Lang) -> Vec<String> {
    if let Some(first) = tokens.first() {
        if articles(lang).contains(&first.as_str()) {
            return tokens[1..].to_vec();
        }
    }
    tokens.to_vec()
}

fn pronouns(lang: Lang) -> &'static [(&'static str, Person)] {
    match lang {
        Lang::En => EN_PRONOUNS,
        Lang::Nl => NL_PRONOUNS,
    }
}

fn possessive_pronouns(lang: Lang) -> &'static [(Person, &'static str)] {
    match lang {
        Lang::En => POSSESSIVE_EN,
        Lang::Nl => POSSESSIVE_NL,
    }
}

fn find(word: &str, lang: Lang) -> Option<&'static Entry> {
    match lang {
        Lang::En => find_by_english(word),
        Lang::Nl => find_by_dutch(word),
    }
}

fn adposition_for(word: &str, lang: Lang) -> Option<&'static str> {
    ADPOSITIONS.iter().find_map(|(gkh, en, nl)| {
        let list = match lang {
            Lang::En => *en,
            Lang::Nl => *nl,
        };
        if list.contains(&word) {
            Some(*gkh)
        } else {
            None
        }
    })
}

fn modal_for(word: &str, lang: Lang) -> Option<&'static str> {
    MODALS.iter().find_map(|(gkh, en, nl, _, _)| {
        let list = match lang {
            Lang::En => *en,
            Lang::Nl => *nl,
        };
        if list.contains(&word) {
            Some(*gkh)
        } else {
            None
        }
    })
}

fn lookup_adjective(word: &str, lang: Lang) -> Option<(&'static Entry, Degree)> {
    let base = degree_base(word, lang);
    let degree = if base == word {
        Degree::Plain
    } else if matches!(lang, Lang::En) && (word.starts_with("most ") || word.ends_with("est")) {
        Degree::Superlative
    } else if matches!(lang, Lang::Nl) && (word.starts_with("meest ") || word.ends_with("st")) {
        Degree::Superlative
    } else {
        Degree::Comparative
    };

    if let Some(entry) = find(&base, lang) {
        if entry.pos == "adjective" {
            return Some((entry, degree));
        }
    }
    if let Some(plain) = find(word, lang) {
        if plain.pos == "adjective" {
            return Some((plain, Degree::Plain));
        }
    }
    None
}

fn lookup_noun_or_pronoun(word: &str, lang: Lang) -> Result<Np, ParseFailure> {
    if let Some(person) = pronoun_person(word, pronouns(lang)) {
        return Ok(Np::pronoun(person, word.to_string()));
    }

    let (base, plural) = singularize(word, lang);
    // A word is only plural if its SINGULAR is what the lexicon matched.
    // "toren" ends in -en, but "tor" is not a word, so the entry matched the
    // full form and the noun is singular.
    let base_entry = if base == word { None } else { find(&base, lang) };
    let entry = base_entry.or_else(|| find(word, lang));

    let Some(entry) = entry else {
        return Err(ParseFailure::UnknownWord(word.to_string()));
    };

    let mut np = Np::noun(entry.root.unwrap_or(entry.gkh).to_string(), Some(entry));
    np.plural = base_entry.is_some() && plural;
    Ok(np)
}

/// Consumes a noun phrase from the front of `tokens`.
pub fn consume_natural_np(tokens: &[String], lang: Lang) -> Result<(Np, Vec<String>), ParseFailure> {
    let t = strip_article(tokens, lang);
    if t.is_empty() {
        return Err(ParseFailure::UnsupportedPattern);
    }

    // "my strength" / "mijn kracht"
    if let Some((person, _)) = possessive_pronouns(lang).iter().find(|(_, w)| *w == t[0]) {
        let (mut possessum, rest) = consume_natural_np(&t[1..], lang)?;
        possessum.possessive = Some(Possessive::Suffix(*person));
        return Ok((possessum, rest));
    }

    // "X's Y" in English.
    if lang == Lang::En {
        if let Some(idx) = t.iter().position(|w| w == "'s" || w.ends_with("'s")) {
            let possessor_word = if t[idx] == "'s" {
                t.get(idx.wrapping_sub(1)).cloned().unwrap_or_default()
            } else {
                t[idx].trim_end_matches("'s").to_string()
            };
            let possessor = lookup_noun_or_pronoun(&possessor_word, lang)?;
            let (mut possessum, rest) = consume_natural_np(&t[idx + 1..], lang)?;
            possessum.possessive = Some(Possessive::Postposition(Box::new(possessor)));
            return Ok((possessum, rest));
        }
    } else if let Some(van_idx) = t.iter().position(|w| w == "van") {
        if van_idx > 0 {
            let mut possessum = lookup_noun_or_pronoun(&t[van_idx - 1], lang)?;
            let possessor_rest = strip_article(&t[van_idx + 1..], lang);
            if let Some(first) = possessor_rest.first() {
                let possessor = lookup_noun_or_pronoun(first, lang)?;
                possessum.possessive = Some(Possessive::Postposition(Box::new(possessor)));
                return Ok((possessum, possessor_rest[1..].to_vec()));
            }
        }
    }

    let mut np = lookup_noun_or_pronoun(&t[0], lang)?;
    let mut rest = t[1..].to_vec();

    // Subject-gap relative clause: "[head] who [verb] [object]".
    // English "that" is a relativiser only here, after a head noun; at clause
    // level it is the complementiser, and what precedes it decides which.
    let relativisers = match lang {
        Lang::En => EN_RELATIVISERS,
        Lang::Nl => NL_RELATIVISERS,
    };
    if rest.len() >= 2 && relativisers.contains(&rest[0].as_str()) {
        // Dutch relative clauses are verb-final, English verb-first.
        let verb_surface = match lang {
            Lang::Nl => rest[rest.len() - 1].clone(),
            Lang::En => rest[1].clone(),
        };
        if let Some(rel_entry) = resolve_content_word(&verb_surface, lang) {
            if rel_entry.pos == "verb" || rel_entry.pos == "particle/verb" {
                let after_verb: Vec<String> = match lang {
                    Lang::Nl => rest[1..rest.len() - 1].to_vec(),
                    Lang::En => rest[2..].to_vec(),
                };
                let mut rel_object = None;
                let mut remaining: Vec<String> = Vec::new();
                if !after_verb.is_empty() {
                    let (obj, rem) = consume_natural_np(&after_verb, lang)?;
                    rel_object = Some(obj);
                    if lang == Lang::Nl {
                        if !rem.is_empty() {
                            return Err(ParseFailure::UnsupportedPattern);
                        }
                    } else {
                        remaining = rem;
                    }
                }
                np.relative = Some(Box::new(RelativeClause {
                    verb: VerbPhrase {
                        root: rel_entry.root.unwrap_or(rel_entry.gkh).to_string(),
                        tense: Tense::Present,
                        is_copula: false,
                        entry: Some(rel_entry),
                    },
                    object: rel_object,
                }));
                rest = remaining;
            }
        }
    }

    Ok((np, rest))
}

/// Parses an English or Dutch clause.
pub fn parse_natural_clause(tokens: &[String], lang: Lang, is_question_mark: bool) -> Result<Clause, ParseFailure> {
    let mut t: Vec<String> = tokens.to_vec();
    if t.is_empty() {
        return Err(ParseFailure::EmptyInput);
    }

    let q_words = match lang {
        Lang::En => EN_QUESTION_WORDS,
        Lang::Nl => NL_QUESTION_WORDS,
    };
    let mut question_word = None;
    if let Some(first) = t.first() {
        if let Some((_, key)) = q_words.iter().find(|(w, _)| w == first) {
            question_word = QuestionWord::from_key(key);
            t.remove(0);
        }
    }

    // Strip do-support used only to mark a question.
    let mut question_yes_no = is_question_mark && question_word.is_none();
    if lang == Lang::En && t.first().map(|w| EN_AUX_DO.contains(&w.as_str())).unwrap_or(false) {
        if question_word.is_none() {
            question_yes_no = true;
        }
        t.remove(0);
    }

    let neg_set = match lang {
        Lang::En => EN_NEGATION,
        Lang::Nl => NL_NEGATION,
    };
    let mut negate = false;
    if let Some(idx) = t.iter().position(|w| neg_set.contains(&w.as_str())) {
        negate = true;
        t.remove(idx);
    }
    if lang == Lang::En {
        t.retain(|w| !EN_AUX_DO.contains(&w.as_str()));
    }

    // An imperative has no subject and opens with a bare verb. Checked before
    // the subject is consumed, and only when nothing marks a question.
    let imperative_candidate = question_word.is_none()
        && !question_yes_no
        && !is_question_mark
        && !t.is_empty()
        && pronoun_person(&t[0], pronouns(lang)).is_none();
    if imperative_candidate {
        if let Some(as_verb) = resolve_content_word(&t[0], lang) {
            if as_verb.pos == "verb" || as_verb.pos == "particle/verb" {
                let mut rest = t[1..].to_vec();
                let mut pp = None;
                if let Some(prep_at) = rest.iter().position(|w| adposition_for(w, lang).is_some()) {
                    let postposition = adposition_for(&rest[prep_at], lang).expect("checked");
                    if let Ok((np, rem)) = consume_natural_np(&rest[prep_at + 1..], lang) {
                        if rem.is_empty() {
                            pp = Some(PostpositionalPhrase { np, postposition: postposition.to_string() });
                            rest = rest[..prep_at].to_vec();
                        }
                    }
                }
                let mut object = None;
                if !rest.is_empty() {
                    let (obj, rem) = consume_natural_np(&rest, lang)?;
                    if !rem.is_empty() {
                        return Err(ParseFailure::UnsupportedPattern);
                    }
                    object = Some(obj);
                }
                return Ok(Clause {
                    negate,
                    imperative: true,
                    verb: Some(VerbPhrase {
                        root: as_verb.root.unwrap_or(as_verb.gkh).to_string(),
                        tense: Tense::Present,
                        is_copula: false,
                        entry: Some(as_verb),
                    }),
                    object,
                    postpositional: pp,
                    ..Clause::default()
                });
            }
        }
    }

    let mut question_role = None;
    let mut subject = None;

    if question_word.is_some() {
        let first_is_verb = t
            .first()
            .filter(|w| pronoun_person(w, pronouns(lang)).is_none())
            .and_then(|w| resolve_content_word(w, lang))
            .map(|e| e.pos == "verb" || e.pos == "particle/verb")
            .unwrap_or(false);
        if first_is_verb {
            question_role = Some(QuestionRole::Subject);
        } else {
            let (np, rest) = consume_natural_np(&t, lang)?;
            subject = Some(np);
            t = rest;
        }
    } else {
        let (np, rest) = consume_natural_np(&t, lang)?;
        subject = Some(np);
        t = rest;
    }

    if t.is_empty() {
        return Err(ParseFailure::UnsupportedPattern);
    }

    let mut tense = Tense::Present;
    let future_aux = match lang {
        Lang::En => EN_FUTURE_AUX,
        Lang::Nl => NL_FUTURE_AUX,
    };
    if future_aux.contains(&t[0].as_str()) {
        tense = Tense::Future;
        t.remove(0);
    }

    // A modal takes the tense and hands the main verb through as a bare root.
    let mut modal = None;
    if t.len() >= 2 {
        if let Some(modal_gkh) = modal_for(&t[0], lang) {
            modal = Some(VerbPhrase {
                root: modal_gkh.to_string(),
                tense,
                is_copula: false,
                entry: crate::morphology::find_by_gkh(modal_gkh),
            });
            t.remove(0);
        }
    }

    let verb_word = t.remove(0);
    let copula_words = match lang {
        Lang::En => EN_COPULA_WORDS,
        Lang::Nl => NL_COPULA_WORDS,
    };
    let is_copula = copula_words.contains(&verb_word.as_str());
    let mut verb_entry: Option<&'static Entry> = None;
    let mut verb_root = "ash".to_string();

    if is_copula {
        if ["was", "were", "waren"].contains(&verb_word.as_str()) {
            tense = Tense::Past;
        }
    } else {
        let past_map: &[(&str, &str)] = match lang {
            Lang::En => crate::morphology::closed_class::EN_PAST_FORMS,
            Lang::Nl => crate::morphology::closed_class::NL_PAST_FORMS,
        };
        let mut infinitive_surface = verb_word.clone();
        if let Some((infinitive, _)) = past_map.iter().find(|(_, past)| *past == verb_word) {
            tense = Tense::Past;
            infinitive_surface = (*infinitive).to_string();
        }

        verb_entry = find(&infinitive_surface, lang).or_else(|| {
            resolve_content_word(&infinitive_surface, lang)
                .filter(|e| e.pos == "verb" || e.pos == "particle/verb")
        });

        let Some(entry) = verb_entry else {
            return Err(ParseFailure::UnknownWord(verb_word));
        };
        if entry.pos != "verb" && entry.pos != "particle/verb" {
            return Err(ParseFailure::UnsupportedPattern);
        }
        verb_root = entry.root.unwrap_or(entry.gkh).to_string();
    }

    let verb = VerbPhrase { root: verb_root, tense, is_copula, entry: verb_entry };

    // A trailing prepositional phrase becomes a postpositional one. Split it
    // off before the object, so "I go to the tower" has no object at all.
    let mut postpositional = None;
    if let Some(prep_idx) = t.iter().position(|w| adposition_for(w, lang).is_some()) {
        let pp_tokens = t[prep_idx + 1..].to_vec();
        if pp_tokens.is_empty() {
            return Err(ParseFailure::UnsupportedPattern);
        }
        let (np, rem) = consume_natural_np(&pp_tokens, lang)?;
        if !rem.is_empty() {
            return Err(ParseFailure::UnsupportedPattern);
        }
        postpositional = Some(PostpositionalPhrase {
            np,
            postposition: adposition_for(&t[prep_idx], lang).expect("checked").to_string(),
        });
        t = t[..prep_idx].to_vec();
    }

    if is_copula && !t.is_empty() {
        let joined = t.join(" ");
        if let Some((entry, degree)) = lookup_adjective(&joined, lang).or_else(|| lookup_adjective(&t[0], lang)) {
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
                    root: entry.root.unwrap_or(entry.gkh).to_string(),
                    entry: Some(entry),
                    degree,
                    intensified: false,
                }),
                ..Clause::default()
            });
        }
    }

    if t.is_empty() {
        let mut clause = Clause {
            negate,
            question_yes_no,
            question_word,
            question_role,
            subject,
            verb: Some(verb),
            modal,
            postpositional,
            ..Clause::default()
        };
        if question_word.is_some() && question_role.is_none() {
            clause.question_role = Some(QuestionRole::Adjunct);
        }
        return Ok(clause);
    }

    let (object, rem) = consume_natural_np(&t, lang)?;
    if !rem.is_empty() {
        return Err(ParseFailure::UnsupportedPattern);
    }

    Ok(Clause {
        negate,
        question_yes_no,
        question_word,
        question_role,
        subject,
        verb: Some(verb),
        object: Some(object),
        modal,
        postpositional,
        ..Clause::default()
    })
}
