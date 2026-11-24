//! Vocabulary: the words the language has, and the words it generates when it
//! does not have one.

mod coinage_index;
mod coiner;

pub use coinage_index::{gloss_coinage, record_coinage, seeded_coinage_count};
pub use coiner::{coin, normalise_seed, CoinInput, CoinedWord, CoinerError, COINER_VERSION};
