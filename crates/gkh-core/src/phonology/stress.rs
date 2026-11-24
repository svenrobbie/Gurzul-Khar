//! Where the stress falls.
//!
//! Implements `phonology.json`'s `stress.defaultRule` and its exceptions:
//! penultimate by default, shifting to the final syllable when that syllable
//! carries a long vowel or a diphthong; a monosyllable stresses its one
//! syllable.

use crate::phonology::syllabify::Syllable;

/// Index of the stressed syllable, or `None` for a word with no vowel.
pub fn stressed_syllable_index(syllables: &[Syllable]) -> Option<usize> {
    match syllables.len() {
        0 => None,
        1 => Some(0),
        n => {
            let last = &syllables[n - 1];
            if last.nucleus.is_long || last.nucleus.is_diphthong {
                Some(n - 1)
            } else {
                Some(n - 2)
            }
        }
    }
}
