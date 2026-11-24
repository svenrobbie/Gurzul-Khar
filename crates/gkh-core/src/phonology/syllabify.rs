//! Divides a phoneme stream into syllables, following the template
//! (C)(C)V(V)(C)(C) and the cluster tables in `phonology.json`.

use crate::data::{CODA_CLUSTERS, ONSET_CLUSTERS};
use crate::phonology::phonemes::PhonemeToken;

/// One syllable: an optional onset, a single vowel nucleus, an optional coda.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Syllable {
    /// Consonants before the vowel.
    pub onset: Vec<PhonemeToken>,
    /// The vowel — already atomic, so a diphthong is one token.
    pub nucleus: PhonemeToken,
    /// Consonants after the vowel.
    pub coda: Vec<PhonemeToken>,
}

impl Syllable {
    /// The syllable as written.
    pub fn to_latin(&self) -> String {
        let mut out: String = self.onset.iter().map(|t| t.latin).collect();
        out.push_str(self.nucleus.latin);
        out.extend(self.coda.iter().map(|t| t.latin));
        out
    }
}

fn pair_latin(a: &PhonemeToken, b: &PhonemeToken) -> String {
    format!("{}{}", a.latin, b.latin)
}

fn onset_cluster_allowed(a: &PhonemeToken, b: &PhonemeToken) -> bool {
    ONSET_CLUSTERS.contains(&pair_latin(a, b).as_str())
}

fn coda_cluster_allowed(a: &PhonemeToken, b: &PhonemeToken) -> bool {
    CODA_CLUSTERS.contains(&pair_latin(a, b).as_str())
}

/// Splits a run of consonants between two vowels into (coda, next onset).
///
/// Maximal onset, constrained by the documented cluster tables: give as much
/// as legally possible to the following syllable, fall back to a legal coda,
/// and only then split one-and-the-rest. `phonology.json` documents which
/// clusters are legal but not how to divide a medial run, so this is the
/// smallest consistent extension — recorded in DESIGN_DECISIONS.md and
/// identical to the TypeScript implementation.
fn split_medial_cluster(run: &[PhonemeToken]) -> (Vec<PhonemeToken>, Vec<PhonemeToken>) {
    match run.len() {
        0 => (Vec::new(), Vec::new()),
        1 => (Vec::new(), run.to_vec()),
        2 => {
            if onset_cluster_allowed(&run[0], &run[1]) {
                (Vec::new(), run.to_vec())
            } else if coda_cluster_allowed(&run[0], &run[1]) {
                (run.to_vec(), Vec::new())
            } else {
                (vec![run[0].clone()], vec![run[1].clone()])
            }
        }
        n => {
            let tail2 = &run[n - 2..];
            if onset_cluster_allowed(&tail2[0], &tail2[1]) {
                return (run[..n - 2].to_vec(), tail2.to_vec());
            }
            let head2 = &run[..2];
            if coda_cluster_allowed(&head2[0], &head2[1]) {
                return (head2.to_vec(), run[2..].to_vec());
            }
            (run[..n - 1].to_vec(), run[n - 1..].to_vec())
        }
    }
}

/// Divides a tokenized word into syllables. A word with no vowel has none.
pub fn syllabify(tokens: &[PhonemeToken]) -> Vec<Syllable> {
    let vowel_idx: Vec<usize> = tokens
        .iter()
        .enumerate()
        .filter(|(_, t)| t.is_vowel())
        .map(|(i, _)| i)
        .collect();

    if vowel_idx.is_empty() {
        return Vec::new();
    }

    let mut onsets: Vec<Vec<PhonemeToken>> = vec![Vec::new(); vowel_idx.len()];
    let mut codas: Vec<Vec<PhonemeToken>> = vec![Vec::new(); vowel_idx.len()];

    // Everything before the first vowel is the first syllable's onset.
    onsets[0] = tokens[..vowel_idx[0]].to_vec();

    for s in 0..vowel_idx.len() {
        if s < vowel_idx.len() - 1 {
            let run = &tokens[vowel_idx[s] + 1..vowel_idx[s + 1]];
            let (coda, next_onset) = split_medial_cluster(run);
            codas[s] = coda;
            onsets[s + 1] = next_onset;
        } else {
            // Everything after the last vowel is the last syllable's coda.
            codas[s] = tokens[vowel_idx[s] + 1..].to_vec();
        }
    }

    vowel_idx
        .into_iter()
        .enumerate()
        .map(|(s, idx)| Syllable {
            onset: std::mem::take(&mut onsets[s]),
            nucleus: tokens[idx].clone(),
            coda: std::mem::take(&mut codas[s]),
        })
        .collect()
}
