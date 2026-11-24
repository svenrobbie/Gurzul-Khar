//! Closed-class English and Dutch knowledge used only to parse the two
//! interface languages.
//!
//! This is NOT Gurzûl Khar grammar — all of that lives in `data/` and is
//! compiled in. These are ordinary facts about English and Dutch that the
//! translator needs in order to recognise an inflected form, kept here so the
//! two kinds of knowledge never get confused for one another.
//!
//! Insertion order is preserved from the TypeScript objects, because several
//! lookups return the FIRST match and a different order would resolve a word
//! differently.

/// English irregular past tenses, keyed by infinitive.
pub static EN_PAST_FORMS: &[(&str, &str)] = &[
    ("go", "went"),
    ("see", "saw"),
    ("have", "had"),
    ("know", "knew"),
    ("give", "gave"),
    ("burn", "burned"),
    ("speak", "spoke"),
    ("eat", "ate"),
    ("drink", "drank"),
    ("love", "loved"),
    ("build", "built"),
    ("see_", "saw"),
];

/// English irregular third-person singular present, keyed by infinitive.
pub static EN_PRESENT_3SG_IRREGULAR: &[(&str, &str)] =
    &[("go", "goes"), ("have", "has"), ("know", "knows"), ("speak", "speaks")];

/// Dutch infinitives whose present stem is not "strip -en".
pub static NL_IRREGULAR_STEM: &[(&str, &str)] = &[
    ("gaan", "ga"),
    ("zien", "zie"),
    ("zijn", "ben"),
    ("slaan", "sla"),
    ("staan", "sta"),
    ("doen", "doe"),
];

/// Dutch irregular past tenses, keyed by infinitive.
pub static NL_PAST_FORMS: &[(&str, &str)] = &[
    ("gaan", "ging"),
    ("zien", "zag"),
    ("hebben", "had"),
    ("weten", "wist"),
    ("geven", "gaf"),
    ("branden", "brandde"),
    ("spreken", "sprak"),
    ("eten", "at"),
    ("drinken", "dronk"),
];

/// Dutch third-person singular present forms that are not stem + -t.
pub static NL_PRESENT_3SG_IRREGULAR: &[(&str, &str)] = &[
    ("hebben", "heeft"),
    ("zijn", "is"),
    ("kunnen", "kan"),
    ("mogen", "mag"),
    ("moeten", "moet"),
    ("willen", "wil"),
    ("zullen", "zal"),
    ("weten", "weet"),
    ("doen", "doet"),
];

/// Forms of "to be" in each interface language.
pub static EN_COPULA_FORMS: &[&str] = &["is", "are", "am", "was", "were", "be", "been"];
/// Forms of "zijn" in Dutch.
pub static NL_COPULA_FORMS: &[&str] = &["is", "ben", "bent", "zijn", "was", "waren", "geweest"];
