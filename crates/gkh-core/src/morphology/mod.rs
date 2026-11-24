//! Word structure: recognising inflected forms, splitting compounds, and
//! deciding when a word is genuinely new.

pub mod closed_class;
mod inflection;
mod lemmatizer;
mod lookup;

pub use inflection::{degree_base, resolve_content_word, singularize, Lang};
pub use lemmatizer::{guess_lemma, lemmatize, CompoundPart, LemmaKind, LemmaResult};
pub use lookup::{find_by_dutch, find_by_english, find_by_gkh, find_by_gkh_and_pos};
