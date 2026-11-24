//! Translation between English, Dutch and Gurzûl Khar.

mod analyzer;
mod model;
pub mod natural_tables;
mod parse_gkh;
mod parse_natural;
mod render_gkh;
mod render_natural;
mod translate;

pub use analyzer::{analyze_word, Affix, AffixType, MorphAnalysis};
pub use model::*;
pub use parse_natural::{consume_natural_np, parse_natural_clause};
pub use parse_gkh::{consume_np, parse_gkh_clause};
pub use render_gkh::{plural_of, render_clause_gkh, render_np, render_verb};
pub use translate::{translate, CoinedEntry, Direction, Translation, TranslationOk};
pub use render_natural::{decapitalize_clause, render_clause_natural, render_np_natural, render_verb_natural};
