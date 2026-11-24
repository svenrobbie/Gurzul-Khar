//! Properties the hand-authored vocabulary has to keep.
//!
//! These replace the TypeScript suite that used to assert them. Each one has
//! caught a real mistake at least once, which is why they are here rather than
//! trusted to care.

use gkh_core::data::coiner::RESERVED_FORMS;
use gkh_core::data::lexicon::ENTRIES;
use gkh_core::data::{all_vowels, CONSONANTS};
use gkh_core::phonology::{ipa_of_word, try_tokenize_word};

mod golden {
    include!("generated/coiner_golden.rs");
}

fn bare(gkh: &str) -> String {
    gkh.replace('-', "").to_lowercase()
}

#[test]
fn every_entry_tokenizes() {
    let bad: Vec<String> = ENTRIES
        .iter()
        .filter(|e| try_tokenize_word(&bare(e.gkh)).is_none())
        .map(|e| format!("{} \"{}\"", e.id, e.gkh))
        .collect();
    assert!(
        bad.is_empty(),
        "these spellings use a sound outside the declared inventory: {bad:?}"
    );
}

#[test]
fn stored_ipa_is_exactly_what_the_engine_generates() {
    // The field is derived data, not an independent opinion. It used to be
    // hand-written and had drifted: 152 entries had lost their stress mark,
    // 135 wrote the uvular trill as a plain Latin r, and five were simply
    // wrong. Regenerate with `npm run lexicon:ipa` rather than editing it.
    let drifted: Vec<String> = ENTRIES
        .iter()
        .filter_map(|e| {
            let generated = ipa_of_word(&bare(e.gkh));
            (generated != e.ipa).then(|| format!("{} \"{}\": stored {}, engine {}", e.id, e.gkh, e.ipa, generated))
        })
        .collect();
    assert!(drifted.is_empty(), "stored IPA no longer matches the engine: {drifted:?}");
}

#[test]
fn stored_ipa_uses_only_symbols_the_inventory_declares() {
    // A Latin r where phonology.json declares the uvular trill ʀ is the exact
    // kind of typo that reads as correct and renders as wrong. Rather than
    // guessing at a blocklist, every character is checked against the symbols
    // the inventory actually declares — q really is IPA here, r really is not.
    let mut allowed: Vec<char> = CONSONANTS
        .iter()
        .map(|c| c.ipa)
        .chain(all_vowels().map(|v| v.ipa))
        .flat_map(|ipa| ipa.chars())
        .collect();
    // Stress mark, length mark, and the non-syllabic diacritic the diphthongs
    // are written with — notation, not phonemes.
    allowed.extend(['ˈ', 'ˌ', 'ː', '\u{32f}']);
    allowed.sort_unstable();
    allowed.dedup();

    let suspect: Vec<String> = ENTRIES
        .iter()
        .filter_map(|e| {
            let stray: Vec<char> = e.ipa.chars().filter(|c| !allowed.contains(c)).collect();
            (!stray.is_empty()).then(|| format!("{} \"{}\" -> {} (stray: {stray:?})", e.id, e.gkh, e.ipa))
        })
        .collect();
    assert!(
        suspect.is_empty(),
        "these IPA strings use a symbol the phoneme inventory never declares: {suspect:?}"
    );
}

#[test]
fn the_frozen_snapshot_still_matches_the_entries_it_was_taken_from() {
    // coiner_v1 avoids a FROZEN snapshot of the lexicon, not the live one, so
    // the dictionary can grow without any coined word moving. The snapshot
    // must therefore keep every spelling it was taken with, even if an entry
    // has since been renamed — the coiner's output depends on it.
    let missing: Vec<&str> = RESERVED_FORMS
        .iter()
        .filter(|form| !ENTRIES.iter().any(|e| bare(e.gkh) == **form))
        .copied()
        .collect();
    assert!(
        missing.is_empty(),
        "a spelling in coinerReserved_v1.json no longer exists in the lexicon. \
         Leave the snapshot alone: renaming an entry is fine, un-reserving it is not. Missing: {missing:?}"
    );
}

#[test]
fn no_entry_added_since_the_freeze_takes_a_spelling_the_coiner_has_issued() {
    // The other half of the frozen-coiner bargain. A newly hand-authored word
    // could take a spelling the coiner already issued to some other gloss,
    // which would make one spelling mean two things in a language whose whole
    // promise is that it does not. This caught seven collisions the day it was
    // written. Fix it by choosing a different spelling for the new entry —
    // never by editing the golden file, since the coined word may already be
    // written down somewhere.
    let issued: Vec<(&str, &str)> = golden::GOLDEN_TSV
        .lines()
        .filter_map(|line| {
            let f: Vec<&str> = line.split('\t').collect();
            (f.len() >= 4).then(|| (f[3], f[0]))
        })
        .collect();

    let clashes: Vec<String> = ENTRIES
        .iter()
        .filter_map(|e| {
            let form = bare(e.gkh);
            if RESERVED_FORMS.contains(&form.as_str()) {
                return None;
            }
            issued
                .iter()
                .find(|(gkh, _)| *gkh == form)
                .map(|(_, lemma)| format!("{} \"{}\" ({} / {}) is already the coined form of \"{}\"", e.id, form, e.en, e.nl, lemma))
        })
        .collect();

    assert!(
        clashes.is_empty(),
        "a hand-authored entry has taken a spelling coiner_v1 already issued: {clashes:?}"
    );
}

#[test]
fn every_entry_round_trips_through_the_phoneme_tokenizer() {
    // Latin -> phonemes -> Latin has to be lossless, or native-script
    // rendering is drawing a different word from the one written.
    let broken: Vec<String> = ENTRIES
        .iter()
        .filter_map(|e| {
            let word = bare(e.gkh);
            let tokens = try_tokenize_word(&word)?;
            let back: String = tokens.iter().map(|t| t.latin).collect();
            (back != word).then(|| format!("{} \"{}\" came back as \"{}\"", e.id, word, back))
        })
        .collect();
    assert!(broken.is_empty(), "the round trip is lossy for: {broken:?}");
}

#[test]
fn entry_ids_are_unique() {
    let mut ids: Vec<&str> = ENTRIES.iter().map(|e| e.id).collect();
    ids.sort_unstable();
    let before = ids.len();
    ids.dedup();
    assert_eq!(before, ids.len(), "duplicate entry id in the lexicon");
}
