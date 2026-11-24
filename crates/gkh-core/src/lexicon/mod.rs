//! Vocabulary: the words the language has, and the words it generates when it
//! does not have one.

mod coiner;

pub use coiner::{coin, normalise_seed, CoinInput, CoinedWord, CoinerError, COINER_VERSION};
