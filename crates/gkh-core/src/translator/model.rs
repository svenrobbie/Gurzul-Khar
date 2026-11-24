//! The clause model shared by both translation directions.
//!
//! One canonical representation in the middle is what lets the translator stay
//! deterministic and auditable: English and Dutch parse INTO this, Gurzûl Khar
//! renders FROM it, and the reverse. A feature supported in one direction is
//! therefore supported in the other by construction.

use crate::data::lexicon::Entry;

/// Grammatical person.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Person {
    /// I
    S1,
    /// you (singular)
    S2,
    /// he / she / it
    S3,
    /// we
    P1,
    /// you (plural)
    P2,
    /// they
    P3,
}

impl Person {
    /// The key used in the generated grammar tables.
    pub fn key(self) -> &'static str {
        match self {
            Self::S1 => "1sg",
            Self::S2 => "2sg",
            Self::S3 => "3sg",
            Self::P1 => "1pl",
            Self::P2 => "2pl",
            Self::P3 => "3pl",
        }
    }

    /// Parses a table key back into a person.
    pub fn from_key(key: &str) -> Option<Self> {
        Some(match key {
            "1sg" => Self::S1,
            "2sg" => Self::S2,
            "3sg" => Self::S3,
            "1pl" => Self::P1,
            "2pl" => Self::P2,
            "3pl" => Self::P3,
            _ => return None,
        })
    }
}

/// When the action happens.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tense {
    /// Present.
    Present,
    /// Past.
    Past,
    /// Future.
    Future,
}

impl Tense {
    /// The key used in the generated tense table.
    pub fn key(self) -> &'static str {
        match self {
            Self::Present => "present",
            Self::Past => "past",
            Self::Future => "future",
        }
    }
}

/// Adjective degree.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Degree {
    /// Plain.
    Plain,
    /// More X.
    Comparative,
    /// Most X.
    Superlative,
}

/// Which role a question word plays.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuestionRole {
    /// The question word is the subject: "who sees the land?"
    Subject,
    /// The question word is the object: "what do you see?"
    Object,
    /// Neither: "where do you go?"
    Adjunct,
}

/// The six question words.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuestionWord {
    /// who
    Who,
    /// what
    What,
    /// where
    Where,
    /// when
    When,
    /// why
    Why,
    /// how
    How,
}

impl QuestionWord {
    /// The key used in the generated interrogatives table.
    pub fn key(self) -> &'static str {
        match self {
            Self::Who => "who",
            Self::What => "what",
            Self::Where => "where",
            Self::When => "when",
            Self::Why => "why",
            Self::How => "how",
        }
    }

    /// Parses a table key.
    pub fn from_key(key: &str) -> Option<Self> {
        Some(match key {
            "who" => Self::Who,
            "what" => Self::What,
            "where" => Self::Where,
            "when" => Self::When,
            "why" => Self::Why,
            "how" => Self::How,
            _ => return None,
        })
    }
}

/// An adjective with its degree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdjectivePhrase {
    /// The adjective root.
    pub root: String,
    /// Its lexicon entry, when known.
    pub entry: Option<&'static Entry>,
    /// Plain, comparative or superlative.
    pub degree: Degree,
    /// True when the intensifier is present.
    pub intensified: bool,
}

/// How possession is marked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Possessive {
    /// A suffix on the possessum, used when the possessor is a pronoun.
    Suffix(Person),
    /// `[possessum] ta [possessor]`.
    Postposition(Box<Np>),
}

/// A noun phrase.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Np {
    /// True when this is a pronoun rather than a noun.
    pub is_pronoun: bool,
    /// The person, for a pronoun.
    pub person: Option<Person>,
    /// The Gurzûl Khar root, for a noun.
    pub root: String,
    /// Its lexicon entry, when known.
    pub entry: Option<&'static Entry>,
    /// True when plural.
    pub plural: bool,
    /// An attributive adjective.
    pub adjective: Option<AdjectivePhrase>,
    /// Possession, if marked.
    pub possessive: Option<Possessive>,
    /// A subject-gap relative clause attached to this noun.
    pub relative: Option<Box<RelativeClause>>,
}

impl Np {
    /// A bare noun with nothing attached.
    pub fn noun(root: impl Into<String>, entry: Option<&'static Entry>) -> Self {
        Self {
            is_pronoun: false,
            person: None,
            root: root.into(),
            entry,
            plural: false,
            adjective: None,
            possessive: None,
            relative: None,
        }
    }

    /// A pronoun.
    pub fn pronoun(person: Person, root: impl Into<String>) -> Self {
        Self {
            is_pronoun: true,
            person: Some(person),
            root: root.into(),
            entry: None,
            plural: false,
            adjective: None,
            possessive: None,
            relative: None,
        }
    }
}

/// A subject-gap relative clause: `[head] kha [object] [verb]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelativeClause {
    /// The clause's verb.
    pub verb: VerbPhrase,
    /// Its object, which precedes the verb.
    pub object: Option<Np>,
}

/// A verb with its tense.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerbPhrase {
    /// The root, or `ash` for the copula.
    pub root: String,
    /// When it happens.
    pub tense: Tense,
    /// True for the copula.
    pub is_copula: bool,
    /// Its lexicon entry, when known.
    pub entry: Option<&'static Entry>,
}

/// An adjunct: `[noun phrase] [postposition]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostpositionalPhrase {
    /// The noun phrase.
    pub np: Np,
    /// The postposition that follows it.
    pub postposition: String,
}

/// One clause.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Clause {
    /// True when negated.
    pub negate: bool,
    /// True for a yes/no question.
    pub question_yes_no: bool,
    /// The question word, for a content question.
    pub question_word: Option<QuestionWord>,
    /// What role that question word plays.
    pub question_role: Option<QuestionRole>,
    /// The subject, absent in an imperative.
    pub subject: Option<Np>,
    /// The verb.
    pub verb: Option<VerbPhrase>,
    /// The object.
    pub object: Option<Np>,
    /// A predicate adjective after the copula.
    pub predicate_adjective: Option<AdjectivePhrase>,
    /// An adjunct phrase, which sits at the end of the clause.
    pub postpositional: Option<PostpositionalPhrase>,
    /// True for a command: bare root, no subject.
    pub imperative: bool,
    /// An analytic modal, which carries the tense.
    pub modal: Option<VerbPhrase>,
}

/// Why a parse failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseFailure {
    /// A word is not in the lexicon.
    UnknownWord(String),
    /// Every word is known but no supported pattern matches.
    UnsupportedPattern,
    /// Nothing to translate.
    EmptyInput,
}
