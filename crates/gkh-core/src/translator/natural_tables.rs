//! Closed-class English and Dutch tables used to parse and render the two
//! interface languages. Ordinary EN/NL knowledge, not Gurzûl Khar grammar.

use crate::translator::model::Person;

/// English subject pronouns.
pub static EN_PRONOUNS: &[(&str, Person)] = &[
    ("i", Person::S1),
    ("you", Person::S2),
    ("he", Person::S3),
    ("she", Person::S3),
    ("it", Person::S3),
    ("we", Person::P1),
    ("they", Person::P3),
];

/// Dutch subject pronouns.
pub static NL_PRONOUNS: &[(&str, Person)] = &[
    ("ik", Person::S1),
    ("jij", Person::S2),
    ("je", Person::S2),
    ("u", Person::S2),
    ("hij", Person::S3),
    ("zij", Person::S3),
    ("ze", Person::S3),
    ("het", Person::S3),
    ("wij", Person::P1),
    ("we", Person::P1),
    ("jullie", Person::P2),
];

/// How each person is written back out in English.
pub static PERSON_TO_EN: &[(Person, &str)] = &[
    (Person::S1, "I"),
    (Person::S2, "you"),
    (Person::S3, "he"),
    (Person::P1, "we"),
    (Person::P2, "you all"),
    (Person::P3, "they"),
];

/// How each person is written back out in Dutch.
pub static PERSON_TO_NL: &[(Person, &str)] = &[
    (Person::S1, "ik"),
    (Person::S2, "jij"),
    (Person::S3, "hij"),
    (Person::P1, "wij"),
    (Person::P2, "jullie"),
    (Person::P3, "zij"),
];

/// English possessive pronouns.
pub static POSSESSIVE_EN: &[(Person, &str)] = &[
    (Person::S1, "my"),
    (Person::S2, "your"),
    (Person::S3, "his"),
    (Person::P1, "our"),
    (Person::P2, "your"),
    (Person::P3, "their"),
];

/// Dutch possessive pronouns.
pub static POSSESSIVE_NL: &[(Person, &str)] = &[
    (Person::S1, "mijn"),
    (Person::S2, "jouw"),
    (Person::S3, "zijn"),
    (Person::P1, "ons"),
    (Person::P2, "jullie"),
    (Person::P3, "hun"),
];

/// English question words.
pub static EN_QUESTION_WORDS: &[(&str, &str)] = &[
    ("who", "who"),
    ("what", "what"),
    ("where", "where"),
    ("when", "when"),
    ("why", "why"),
    ("how", "how"),
];

/// Dutch question words, mapped to the same keys.
pub static NL_QUESTION_WORDS: &[(&str, &str)] = &[
    ("wie", "who"),
    ("wat", "what"),
    ("waar", "where"),
    ("wanneer", "when"),
    ("waarom", "why"),
    ("hoe", "how"),
];

/// Articles, which Gurzûl Khar does not have at all.
pub static EN_ARTICLES: &[&str] = &["the", "a", "an"];
/// Dutch articles.
pub static NL_ARTICLES: &[&str] = &["de", "het", "een"];

/// English negation words.
pub static EN_NEGATION: &[&str] = &["not", "no"];
/// Dutch negation words.
pub static NL_NEGATION: &[&str] = &["niet", "geen"];
/// English do-support, used only to mark questions and negation.
pub static EN_AUX_DO: &[&str] = &["do", "does", "did"];
/// English future auxiliary.
pub static EN_FUTURE_AUX: &[&str] = &["will"];
/// Dutch future auxiliary.
pub static NL_FUTURE_AUX: &[&str] = &["zal", "zullen"];
/// English copula forms.
pub static EN_COPULA_WORDS: &[&str] = &["is", "are", "am", "was", "were", "be"];
/// Dutch copula forms.
pub static NL_COPULA_WORDS: &[&str] = &["is", "ben", "bent", "zijn", "was", "waren"];

/// Prepositions in EN/NL become POSTpositions in Gurzûl Khar.
///
/// Dutch "van" is deliberately absent: it is overwhelmingly the possessive
/// ("de kracht van de koning"), and that reading has to win.
pub static ADPOSITIONS: &[(&str, &[&str], &[&str])] = &[
    ("dûl", &["to", "toward", "towards", "into"], &["naar", "tot"]),
    ("mâsh", &["with"], &["met"]),
    ("thûl", &["in", "inside", "within"], &["in", "binnen"]),
    ("lan", &["from", "out"], &["vanaf", "uit"]),
    ("et", &["at", "by", "beside"], &["bij", "aan"]),
    ("zâm", &["on", "upon", "onto"], &["op"]),
    ("nûd", &["under", "beneath", "below"], &["onder"]),
];

/// Modal verbs. "will" is absent: it is already the future tense.
pub static MODALS: &[(&str, &[&str], &[&str], &str, &str)] = &[
    ("dâk", &["must", "shall"], &["moet", "moeten", "moest", "moesten"], "must", "moet"),
    ("mâg", &["can", "could", "may", "might"], &["kan", "kunnen", "kun", "kon", "mag", "mogen"], "can", "kan"),
];

/// Subordinators: `[main] [subordinator] [subordinate]`.
pub static SUBORDINATORS: &[(&str, &str, &[&str], &str)] = &[
    ("sû", "that", &["dat"], "complementiser"),
    ("ghâsha", "because", &["omdat", "want"], "cause"),
    ("ith", "if", &["als", "indien"], "condition"),
    ("râth", "when", &["wanneer", "toen"], "time"),
];

/// Coordinating conjunctions in English.
pub static EN_COORD: &[(&str, &str)] = &[("and", "ag"), ("or", "vo"), ("but", "nâth")];
/// Coordinating conjunctions in Dutch.
pub static NL_COORD: &[(&str, &str)] = &[("en", "ag"), ("of", "vo"), ("maar", "nâth")];

/// Relativisers. English "that" is handled here only after a head noun.
pub static EN_RELATIVISERS: &[&str] = &["who", "which", "that"];
/// Dutch relativisers.
pub static NL_RELATIVISERS: &[&str] = &["die"];

/// Looks up a person by its surface pronoun.
pub fn pronoun_person(word: &str, table: &'static [(&str, Person)]) -> Option<Person> {
    table.iter().find(|(w, _)| *w == word).map(|(_, p)| *p)
}

/// Looks up a surface form for a person.
pub fn person_word(person: Person, table: &'static [(Person, &str)]) -> &'static str {
    table.iter().find(|(p, _)| *p == person).map(|(_, w)| *w).unwrap_or("")
}
