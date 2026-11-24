//! Rendering the clause model into Gurzûl Khar, per `grammar.json` §syntax.

use crate::data::grammar::*;
use crate::data::table_get;
use crate::translator::model::*;

/// Attaches the plural suffix, using the epenthetic allomorph when the root
/// already ends in -k so two k sounds never collide: rûk -> rûkakûk.
pub fn plural_of(root: &str) -> String {
    if root.ends_with('k') {
        format!("{root}{PLURAL_EPENTHETIC}")
    } else {
        format!("{root}{PLURAL_SUFFIX}")
    }
}

/// Renders a verb, including the copula's suppletive forms.
pub fn render_verb(v: &VerbPhrase) -> String {
    if v.is_copula {
        return match v.tense {
            Tense::Present => "ash".to_string(),
            Tense::Past => "ashak".to_string(),
            Tense::Future => "ashâth".to_string(),
        };
    }
    let suffix = table_get(TENSE_SUFFIXES, v.tense.key()).unwrap_or("");
    format!("{}{suffix}", v.root)
}

fn render_adjective(adj: &AdjectivePhrase, out: &mut Vec<String>) {
    if adj.intensified {
        out.push(INTENSIFIER.to_string());
    }
    if adj.degree != Degree::Plain {
        out.push(COMPARATIVE_MARKER.to_string());
    }
    out.push(match adj.degree {
        Degree::Superlative => format!("{}{SUPERLATIVE_SUFFIX}", adj.root),
        _ => adj.root.clone(),
    });
}

/// Renders a noun phrase to its surface tokens.
pub fn render_np(np: &Np) -> Vec<String> {
    let mut tokens = Vec::new();

    let mut base = if np.is_pronoun {
        np.person
            .and_then(|p| table_get(SUBJECT_FORMS, p.key()))
            .unwrap_or(&np.root)
            .to_string()
    } else if np.plural {
        plural_of(&np.root)
    } else {
        np.root.clone()
    };

    if let Some(Possessive::Suffix(person)) = &np.possessive {
        if let Some(suffix) = table_get(POSSESSIVE_SUFFIXES, person.key()) {
            base.push_str(suffix);
        }
    }
    tokens.push(base);

    if let Some(adj) = &np.adjective {
        render_adjective(adj, &mut tokens);
    }

    if let Some(Possessive::Postposition(possessor)) = &np.possessive {
        tokens.push(POSSESSION_MARKER.to_string());
        tokens.extend(render_np(possessor));
    }

    if let Some(relative) = &np.relative {
        tokens.push(RELATIVISER.to_string());
        if let Some(object) = &relative.object {
            tokens.extend(render_np(object));
        }
        tokens.push(render_verb(&relative.verb));
    }

    tokens
}

/// Renders a predicate adjective after the copula.
fn render_predicate_adjective(adj: &AdjectivePhrase) -> Vec<String> {
    let mut out = Vec::new();
    render_adjective(adj, &mut out);
    out
}

/// Renders one clause to surface tokens.
///
/// Order follows `syntax.declarative`: subject, negation, verb, object, then
/// any adjunct. An imperative drops the subject and uses the bare root; a
/// modal takes the tense and leaves the main verb bare.
pub fn render_clause_gkh(c: &Clause) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();

    if let Some(qw) = c.question_word {
        if let Some(form) = table_get(INTERROGATIVES, qw.key()) {
            tokens.push(form.to_string());
        }
    }

    if c.question_role != Some(QuestionRole::Subject) && !c.imperative {
        if let Some(subject) = &c.subject {
            tokens.extend(render_np(subject));
        }
    }

    if c.negate {
        tokens.push(NEGATION_PARTICLE.to_string());
    }

    if let Some(verb) = &c.verb {
        if let Some(modal) = &c.modal {
            // The modal carries the tense; the main verb stays a bare root.
            tokens.push(render_verb(&VerbPhrase {
                root: modal.root.clone(),
                tense: verb.tense,
                is_copula: false,
                entry: modal.entry,
            }));
            tokens.push(verb.root.clone());
        } else if c.imperative {
            tokens.push(verb.root.clone());
        } else {
            tokens.push(render_verb(verb));
        }
    }

    if let Some(adj) = &c.predicate_adjective {
        tokens.extend(render_predicate_adjective(adj));
    } else if c.question_role != Some(QuestionRole::Object) {
        if let Some(object) = &c.object {
            tokens.extend(render_np(object));
        }
    }

    if let Some(pp) = &c.postpositional {
        tokens.extend(render_np(&pp.np));
        tokens.push(pp.postposition.clone());
    }

    if c.question_yes_no && c.question_word.is_none() {
        tokens.push(QUESTION_PARTICLE.to_string());
    }

    tokens
}
