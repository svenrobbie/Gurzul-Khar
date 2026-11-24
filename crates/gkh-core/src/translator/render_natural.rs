//! Rendering the clause model back into English or Dutch.

use crate::morphology::closed_class::*;
use crate::morphology::Lang;
use crate::translator::model::*;
use crate::translator::natural_tables::*;

fn first_gloss(field: &str) -> String {
    field.split('/').next().unwrap_or(field).trim().to_string()
}

fn strip_to(word: &str) -> String {
    word.strip_prefix("to ").unwrap_or(word).to_string()
}

fn table_lookup(table: &'static [(&str, &str)], key: &str) -> Option<&'static str> {
    table.iter().find(|(k, _)| *k == key).map(|(_, v)| *v)
}

fn pluralize_gloss(word: &str, lang: Lang) -> String {
    match lang {
        Lang::En => {
            if word.ends_with('s') {
                return word.to_string();
            }
            let chars: Vec<char> = word.chars().collect();
            if chars.len() >= 2 && chars[chars.len() - 1] == 'y' && !"aeiou".contains(chars[chars.len() - 2]) {
                let stem: String = chars[..chars.len() - 1].iter().collect();
                return format!("{stem}ies");
            }
            format!("{word}s")
        }
        Lang::Nl => {
            if word.ends_with("en") {
                word.to_string()
            } else {
                format!("{word}en")
            }
        }
    }
}

/// Renders a noun phrase into English or Dutch.
pub fn render_np_natural(np: &Np, lang: Lang, with_article: bool) -> String {
    if np.is_pronoun {
        let table = match lang {
            Lang::En => PERSON_TO_EN,
            Lang::Nl => PERSON_TO_NL,
        };
        return np.person.map(|p| person_word(p, table).to_string()).unwrap_or_else(|| np.root.clone());
    }

    let raw = match lang {
        Lang::En => np.entry.map(|e| e.en).unwrap_or(&np.root),
        Lang::Nl => np.entry.map(|e| e.nl).unwrap_or(&np.root),
    };
    let mut gloss = first_gloss(raw);
    if np.plural {
        gloss = pluralize_gloss(&gloss, lang);
    }

    let article = match lang {
        Lang::En => "the",
        Lang::Nl => "de",
    };
    let mut phrase = if with_article { format!("{article} {gloss}") } else { gloss.clone() };

    if let Some(adj) = &np.adjective {
        let adj_raw = match lang {
            Lang::En => adj.entry.map(|e| e.en).unwrap_or(&adj.root),
            Lang::Nl => adj.entry.map(|e| e.nl).unwrap_or(&adj.root),
        };
        let adj_gloss = first_gloss(adj_raw);
        let degreed = match (adj.degree, lang) {
            (Degree::Superlative, Lang::En) => format!("most {adj_gloss}"),
            (Degree::Superlative, Lang::Nl) => format!("meest {adj_gloss}"),
            (Degree::Comparative, Lang::En) => format!("more {adj_gloss}"),
            (Degree::Comparative, Lang::Nl) => format!("meer {adj_gloss}"),
            _ => adj_gloss,
        };
        phrase = format!("{phrase} ({degreed})");
    }

    if let Some(relative) = &np.relative {
        let rel_raw = match lang {
            Lang::En => relative.verb.entry.map(|e| e.en).unwrap_or(&relative.verb.root),
            Lang::Nl => relative.verb.entry.map(|e| e.nl).unwrap_or(&relative.verb.root),
        };
        let rel_verb = strip_to(&first_gloss(rel_raw));
        let conjugated = match lang {
            Lang::En => table_lookup(EN_PRESENT_3SG_IRREGULAR, &rel_verb)
                .map(str::to_string)
                .unwrap_or_else(|| format!("{rel_verb}s")),
            Lang::Nl => table_lookup(NL_PRESENT_3SG_IRREGULAR, &rel_verb)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    let stem = table_lookup(NL_IRREGULAR_STEM, &rel_verb)
                        .map(str::to_string)
                        .unwrap_or_else(|| rel_verb.strip_suffix("en").unwrap_or(&rel_verb).to_string());
                    format!("{stem}t")
                }),
        };
        let rel_object = relative
            .object
            .as_ref()
            .map(|o| render_np_natural(o, lang, !o.is_pronoun))
            .unwrap_or_default();

        // English relative clauses are verb-first, Dutch verb-final.
        phrase = match lang {
            Lang::En => {
                if rel_object.is_empty() {
                    format!("{phrase} who {conjugated}")
                } else {
                    format!("{phrase} who {conjugated} {rel_object}")
                }
            }
            Lang::Nl => {
                if rel_object.is_empty() {
                    format!("{phrase} die {conjugated}")
                } else {
                    format!("{phrase} die {rel_object} {conjugated}")
                }
            }
        };
    }

    match &np.possessive {
        Some(Possessive::Suffix(person)) => {
            let table = match lang {
                Lang::En => POSSESSIVE_EN,
                Lang::Nl => POSSESSIVE_NL,
            };
            phrase = format!("{} {gloss}", person_word(*person, table));
        }
        Some(Possessive::Postposition(possessor)) => {
            let owner = render_np_natural(possessor, lang, !possessor.is_pronoun);
            phrase = match lang {
                Lang::En => format!("{owner}'s {gloss}"),
                Lang::Nl => format!("{gloss} van {owner}"),
            };
        }
        None => {}
    }

    phrase
}

/// Renders the verb, including negation and the copula's suppletive forms.
pub fn render_verb_natural(clause: &Clause, lang: Lang) -> String {
    let Some(verb) = &clause.verb else { return String::new() };
    let negate = clause.negate;
    let person = clause.subject.as_ref().and_then(|s| s.person).unwrap_or(Person::S3);

    if verb.is_copula {
        return match lang {
            Lang::En => {
                let base = match verb.tense {
                    Tense::Present => "is",
                    Tense::Past => "was",
                    Tense::Future => "will be",
                };
                if !negate {
                    base.to_string()
                } else if verb.tense == Tense::Future {
                    "will not be".to_string()
                } else {
                    format!("{} not", base.split(' ').next().unwrap_or(base))
                }
            }
            Lang::Nl => {
                let base = match verb.tense {
                    Tense::Present => "is",
                    Tense::Past => "was",
                    Tense::Future => "zal zijn",
                };
                if negate {
                    format!("{base} niet")
                } else {
                    base.to_string()
                }
            }
        };
    }

    match lang {
        Lang::En => {
            let infinitive = strip_to(&first_gloss(verb.entry.map(|e| e.en).unwrap_or(&verb.root)));
            let form = match verb.tense {
                Tense::Future => format!("will {infinitive}"),
                Tense::Past => table_lookup(EN_PAST_FORMS, &infinitive)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("{infinitive}ed")),
                Tense::Present => {
                    if person == Person::S3 {
                        table_lookup(EN_PRESENT_3SG_IRREGULAR, &infinitive)
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("{infinitive}s"))
                    } else {
                        infinitive.clone()
                    }
                }
            };
            if !negate {
                return form;
            }
            match verb.tense {
                Tense::Future => format!("will not {infinitive}"),
                Tense::Past => format!("did not {infinitive}"),
                Tense::Present => {
                    if person == Person::S3 {
                        format!("does not {infinitive}")
                    } else {
                        format!("do not {infinitive}")
                    }
                }
            }
        }
        Lang::Nl => {
            let infinitive = first_gloss(verb.entry.map(|e| e.nl).unwrap_or(&verb.root));
            let form = match verb.tense {
                Tense::Future => format!("zal {infinitive}"),
                Tense::Past => table_lookup(NL_PAST_FORMS, &infinitive)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("{infinitive}de")),
                Tense::Present => {
                    let stem = table_lookup(NL_IRREGULAR_STEM, &infinitive)
                        .map(str::to_string)
                        .unwrap_or_else(|| infinitive.strip_suffix("en").unwrap_or(&infinitive).to_string());
                    // Adding -t to a stem ending in a single vowel reopens the
                    // syllable, so the vowel doubles: ga -> gaat, never "gat".
                    let stem_t = {
                        let last = stem.chars().last().unwrap_or(' ');
                        if "aeou".contains(last) {
                            format!("{stem}{last}t")
                        } else {
                            format!("{stem}t")
                        }
                    };
                    match person {
                        Person::S1 => stem,
                        Person::P1 | Person::P2 | Person::P3 => infinitive.clone(),
                        _ => stem_t,
                    }
                }
            };
            if negate {
                format!("{form} niet")
            } else {
                form
            }
        }
    }
}

fn question_word_natural(qw: QuestionWord, lang: Lang) -> String {
    let key = qw.key();
    match lang {
        Lang::En => EN_QUESTION_WORDS
            .iter()
            .find(|(_, k)| *k == key)
            .map(|(w, _)| (*w).to_string())
            .unwrap_or_else(|| key.to_string()),
        Lang::Nl => NL_QUESTION_WORDS
            .iter()
            .find(|(_, k)| *k == key)
            .map(|(w, _)| (*w).to_string())
            .unwrap_or_else(|| key.to_string()),
    }
}

/// Renders a clause into English or Dutch.
///
/// `verb_final` renders a Dutch subordinate clause the way Dutch writes one:
/// "omdat de koning sterk is", not "omdat de koning is sterk". It is the
/// mirror of the normalisation applied when parsing.
pub fn render_clause_natural(clause: &Clause, lang: Lang, verb_final: bool) -> String {
    let mut words: Vec<String> = Vec::new();
    let verb_final = verb_final && lang == Lang::Nl;

    if let Some(qw) = clause.question_word {
        words.push(question_word_natural(qw, lang));
    }

    if clause.question_role != Some(QuestionRole::Subject) && !clause.imperative {
        if let Some(subject) = &clause.subject {
            words.push(render_np_natural(subject, lang, !subject.is_pronoun));
        }
    }

    let mut verb_surface = render_verb_natural(clause, lang);

    if clause.imperative {
        // A command is the bare infinitive in English, the stem in Dutch.
        if let Some(verb) = &clause.verb {
            let raw = match lang {
                Lang::En => verb.entry.map(|e| e.en).unwrap_or(&verb.root),
                Lang::Nl => verb.entry.map(|e| e.nl).unwrap_or(&verb.root),
            };
            let infinitive = strip_to(&first_gloss(raw));
            verb_surface = match lang {
                Lang::En => infinitive,
                Lang::Nl => table_lookup(NL_IRREGULAR_STEM, &infinitive)
                    .map(str::to_string)
                    .unwrap_or_else(|| infinitive.strip_suffix("en").unwrap_or(&infinitive).to_string()),
            };
        }
    } else if let Some(modal) = &clause.modal {
        // The modal carries the tense, so the main verb comes back out as a
        // plain infinitive after it.
        if let Some(verb) = &clause.verb {
            let raw = match lang {
                Lang::En => verb.entry.map(|e| e.en).unwrap_or(&verb.root),
                Lang::Nl => verb.entry.map(|e| e.nl).unwrap_or(&verb.root),
            };
            let infinitive = strip_to(&first_gloss(raw));
            let modal_word = MODALS
                .iter()
                .find(|(gkh, _, _, _, _)| *gkh == modal.root)
                .map(|(_, _, _, en, nl)| match lang {
                    Lang::En => *en,
                    Lang::Nl => *nl,
                })
                .unwrap_or(&modal.root);
            verb_surface = format!("{modal_word} {infinitive}");
        }
    }

    if !verb_final {
        words.push(verb_surface.clone());
    }

    if let Some(adj) = &clause.predicate_adjective {
        let raw = match lang {
            Lang::En => adj.entry.map(|e| e.en).unwrap_or(&adj.root),
            Lang::Nl => adj.entry.map(|e| e.nl).unwrap_or(&adj.root),
        };
        let gloss = first_gloss(raw);
        words.push(match (adj.degree, lang) {
            (Degree::Superlative, Lang::En) => format!("the most {gloss}"),
            (Degree::Superlative, Lang::Nl) => format!("het meest {gloss}"),
            (Degree::Comparative, Lang::En) => format!("more {gloss}"),
            (Degree::Comparative, Lang::Nl) => format!("meer {gloss}"),
            _ => gloss,
        });
    } else if clause.question_role != Some(QuestionRole::Object) {
        if let Some(object) = &clause.object {
            words.push(render_np_natural(object, lang, !object.is_pronoun));
        }
    }

    if let Some(pp) = &clause.postpositional {
        let preposition = ADPOSITIONS
            .iter()
            .find(|(gkh, _, _)| *gkh == pp.postposition)
            .map(|(_, en, nl)| match lang {
                Lang::En => en[0],
                Lang::Nl => nl[0],
            });
        if let Some(prep) = preposition {
            words.push(prep.to_string());
            words.push(render_np_natural(&pp.np, lang, !pp.np.is_pronoun));
        }
    }

    if verb_final {
        words.push(verb_surface);
    }

    let sentence = words.join(" ");
    let is_question = clause.question_yes_no || clause.question_word.is_some();
    let mut chars = sentence.chars();
    let capitalised = match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => sentence,
    };

    let terminator = if is_question {
        "?"
    } else if clause.imperative {
        "!"
    } else {
        "."
    };
    format!("{capitalised}{terminator}")
}

/// Lowercases the first letter and strips the terminator, for joining a clause
/// mid-sentence after a conjunction.
pub fn decapitalize_clause(sentence: &str) -> String {
    let stripped = sentence.trim_end_matches(['.', '?', '!']);
    let mut chars = stripped.chars();
    match chars.next() {
        Some(first) => first.to_lowercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}
