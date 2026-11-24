//! The way back from a coined word.
//!
//! `coiner_v1` is a hash, so `han` carries no trace of `draak`. A coined word
//! can therefore only be read back if someone wrote the pairing down. This
//! module is that record: a table compiled in from
//! `data/lexicon/coinages.json`, plus whatever the translator coins while it
//! runs.
//!
//! The runtime half lives in memory and dies with the process. That is a real
//! limit and it is stated rather than hidden: a word nobody has ever coined
//! still comes back bracketed. Making it permanent means writing to
//! `data/lexicon/coinages.json`, which is a job for the proposal flow, not for
//! an engine that has no file I/O at all.
//!
//! The session half is thread-local. In a browser there is one thread, so this
//! is simply "this page"; on a phone or in a test it means each thread keeps
//! its own memory, which is the conservative reading and keeps the core free
//! of locks.

use crate::data::lexicon::COINAGES;
use std::cell::RefCell;

thread_local! {
    /// Coinages made since this thread started: (spelling, lemma, lang).
    static SESSION: RefCell<Vec<(String, String, String)>> = const { RefCell::new(Vec::new()) };
}

/// The gloss to show for a coined word, or `None` when this spelling has never
/// been coined.
///
/// A spelling recorded in the requested language wins; failing that, any
/// record for it is better than bracketing a word the engine did issue.
pub fn gloss_coinage(gkh: &str, lang: &str) -> Option<String> {
    let needle = gkh.to_lowercase();

    let shipped_exact = COINAGES
        .iter()
        .find(|(g, _, l)| *g == needle && *l == lang)
        .map(|(_, lemma, _)| (*lemma).to_string());
    if shipped_exact.is_some() {
        return shipped_exact;
    }

    let session_exact = SESSION.with(|s| {
        s.borrow()
            .iter()
            .find(|(g, _, l)| *g == needle && l == lang)
            .map(|(_, lemma, _)| lemma.clone())
    });
    if session_exact.is_some() {
        return session_exact;
    }

    let shipped_any = COINAGES
        .iter()
        .find(|(g, _, _)| *g == needle)
        .map(|(_, lemma, _)| (*lemma).to_string());
    if shipped_any.is_some() {
        return shipped_any;
    }

    SESSION.with(|s| {
        s.borrow()
            .iter()
            .find(|(g, _, _)| *g == needle)
            .map(|(_, lemma, _)| lemma.clone())
    })
}

/// Remembers a coinage for the rest of this session, so a word just coined in
/// one direction reads back in the other.
pub fn record_coinage(gkh: &str, lemma: &str, lang: &str) {
    let gkh = gkh.to_lowercase();
    SESSION.with(|s| {
        let mut s = s.borrow_mut();
        if s.iter().any(|(g, le, l)| *g == gkh && le == lemma && l == lang) {
            return;
        }
        s.push((gkh, lemma.to_string(), lang.to_string()));
    });
}

/// How many spellings the compiled-in index knows, before anything was added
/// at runtime.
pub fn seeded_coinage_count() -> usize {
    let mut seen: Vec<&str> = COINAGES.iter().map(|(g, _, _)| *g).collect();
    seen.sort_unstable();
    seen.dedup();
    seen.len()
}
