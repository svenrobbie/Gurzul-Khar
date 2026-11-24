//! Tiers 2 and 3 of word coverage, held to the TypeScript's behaviour.
//!
//! The point of these is narrow and important: a word the lexicon CAN account
//! for must never reach the coiner. Every case that regresses to "coined" is a
//! word the translator starts inventing a synonym for.

use gkh_core::morphology::{guess_lemma, lemmatize, Lang, LemmaKind};

mod generated {
    include!("generated/lemmatization.rs");
}

struct Case<'a> {
    word: &'a str,
    lang: Lang,
    kind: Option<LemmaKind>,
    gkh: &'a str,
    parts: Vec<&'a str>,
}

fn cases() -> Vec<Case<'static>> {
    generated::LEMMA_TSV
        .lines()
        .map(|line| {
            let f: Vec<&str> = line.split('\t').collect();
            assert_eq!(f.len(), 5, "malformed row: {line:?}");
            Case {
                word: f[0],
                lang: Lang::from_code(f[1]).expect("lang must be en or nl"),
                kind: match f[2] {
                    "direct" => Some(LemmaKind::Direct),
                    "inflected" => Some(LemmaKind::Inflected),
                    "compound" => Some(LemmaKind::Compound),
                    "" => None,
                    other => panic!("unknown kind {other:?}"),
                },
                gkh: f[3],
                parts: if f[4].is_empty() { Vec::new() } else { f[4].split('|').collect() },
            }
        })
        .collect()
}

#[test]
fn reproduces_every_shared_lemmatisation() {
    let mut failures: Vec<String> = Vec::new();

    for case in cases() {
        let result = lemmatize(case.word, case.lang);

        match (case.kind, &result) {
            (None, Some(got)) => failures.push(format!(
                "{:?} should be coined, but resolved to {} ({:?})",
                case.word, got.gkh, got.kind
            )),
            (Some(_), None) => failures.push(format!(
                "{:?} should resolve to {:?}, but was left to the coiner",
                case.word, case.gkh
            )),
            (Some(expected_kind), Some(got)) => {
                if got.kind != expected_kind {
                    failures.push(format!("{:?}: expected {:?}, got {:?}", case.word, expected_kind, got.kind));
                }
                if got.gkh != case.gkh {
                    failures.push(format!("{:?}: expected {:?}, got {:?}", case.word, case.gkh, got.gkh));
                }
                if !case.parts.is_empty() {
                    let actual: Vec<&str> = got.parts.iter().map(|p| p.entry.gkh).collect();
                    if actual != case.parts {
                        failures.push(format!(
                            "{:?}: expected parts [{}], got [{}]",
                            case.word,
                            case.parts.join(", "),
                            actual.join(", ")
                        ));
                    }
                }
            }
            (None, None) => {}
        }
    }

    assert!(
        failures.is_empty(),
        "Rust and TypeScript disagree on {} word(s):\n  {}",
        failures.len(),
        failures.join("\n  ")
    );
}

#[test]
fn an_inflected_form_never_reaches_the_coiner() {
    // The bug this guards against: coining a brand-new word for "zie", which
    // is simply an inflected form of "zien".
    for (word, lang) in [("zie", Lang::Nl), ("ziet", Lang::Nl), ("huizen", Lang::Nl), ("lands", Lang::En)] {
        assert!(lemmatize(word, lang).is_some(), "{word:?} must resolve, not be coined");
    }
}

#[test]
fn huis_and_huizen_are_one_word() {
    let singular = lemmatize("huis", Lang::Nl).expect("huis resolves");
    let plural = lemmatize("huizen", Lang::Nl).expect("huizen resolves");
    assert_eq!(singular.gkh, plural.gkh);
}

#[test]
fn guess_lemma_collapses_plurals_only_when_it_is_safe() {
    assert_eq!(guess_lemma("ruimteschepen", Lang::Nl), "ruimteschep");
    assert_eq!(guess_lemma("spaceships", Lang::En), "spaceship");
    assert_eq!(guess_lemma("berries", Lang::En), "berry");
    // Short words and non-plurals are left alone.
    assert_eq!(guess_lemma("huis", Lang::Nl), "huis");
    assert_eq!(guess_lemma("glass", Lang::En), "glass");
}
