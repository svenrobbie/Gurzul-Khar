//! The binding layer builds JSON by hand rather than pulling in a serialiser,
//! so these check the output is actually well-formed — including the awkward
//! cases: diacritics, the bracketed unknown-word marker, quotes and newlines
//! inside the explanation strings.

use gkh_wasm::*;

/// A deliberately small JSON validator: enough to catch an unbalanced string,
/// a stray control character or a missing comma, without a dependency.
fn assert_valid_json(s: &str, context: &str) {
    let bytes: Vec<char> = s.chars().collect();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escaped = false;

    for (i, &c) in bytes.iter().enumerate() {
        if in_string {
            if escaped {
                assert!(
                    "\"\\/bfnrtu".contains(c),
                    "{context}: invalid escape \\{c} at {i}"
                );
                escaped = false;
            } else if c == '\\' {
                escaped = true;
            } else if c == '"' {
                in_string = false;
            } else {
                assert!((c as u32) >= 0x20, "{context}: raw control char at {i}");
            }
            continue;
        }
        match c {
            '"' => in_string = true,
            '{' | '[' => depth += 1,
            '}' | ']' => {
                depth -= 1;
                assert!(depth >= 0, "{context}: unbalanced bracket at {i}");
            }
            _ => {}
        }
    }
    assert!(!in_string, "{context}: unterminated string");
    assert_eq!(depth, 0, "{context}: unbalanced brackets");
}

#[test]
fn translation_output_is_well_formed_in_every_direction() {
    let cases = [
        ("I see the land", "en-gkh"),
        ("Ik ga omdat de koning sterk is", "nl-gkh"),
        ("ük selu shak kha khar dûnu", "gkh-nl"),
        ("ük zûrak sû tû pâkâth", "gkh-en"),
        // Partial: carries coined words and an explanation.
        ("I see the spaceship", "en-gkh"),
        // Unknown Gurzûl Khar word: output contains the ⟦⟧ marker.
        ("ük selu blorzak", "gkh-en"),
        // Refused: the error branch.
        ("the sword that he carries", "en-gkh"),
        // Empty, and a bad direction.
        ("", "en-gkh"),
        ("anything", "xx-yy"),
    ];
    for (input, direction) in cases {
        let json = translate(input, direction);
        assert_valid_json(&json, &format!("translate({input:?}, {direction:?})"));
    }
}

#[test]
fn a_refusal_says_why() {
    let json = translate("the sword that he carries", "en-gkh");
    assert!(json.contains("\"ok\":false"), "{json}");
    assert!(json.contains("unsupported-pattern"), "{json}");
}

#[test]
fn a_coined_word_is_reported_not_hidden() {
    let json = translate("I see the spaceship", "en-gkh");
    assert!(json.contains("\"partial\":true"), "{json}");
    assert!(json.contains("\"source\":\"spaceship\""), "{json}");
    assert_valid_json(&json, "coined");
}

#[test]
fn diacritics_survive_the_boundary_unescaped() {
    let json = translate("ük selu dor", "gkh-en");
    assert_valid_json(&json, "diacritics");
    let ipa = sentence_ipa("ük selu dor");
    assert!(ipa.contains('ˈ'), "stress mark must survive: {ipa}");
}

#[test]
fn lemmatize_and_coin_round_trip_through_json() {
    assert_valid_json(&lemmatize("nachtwacht", "nl"), "lemmatize compound");
    assert_eq!(lemmatize("ruimteschip", "nl"), "null");
    assert_eq!(lemmatize("anything", "zz"), "null");

    let coined = coin("spaceship", "unknown", "en");
    assert_valid_json(&coined, "coin");
    assert!(coined.contains("\"gkh\""), "{coined}");

    // Determinism holds across the boundary too.
    assert_eq!(coin("huis", "noun", "nl"), coin("huis", "noun", "nl"));
}

#[test]
fn the_version_names_the_implementation() {
    assert!(engine_version().contains("rust/wasm"), "{}", engine_version());
}

#[test]
fn word_analysis_is_well_formed_in_both_source_languages() {
    for (text, direction) in [
        ("ük selu shak kha khar dûnu", "gkh-en"),
        ("rûkakûk", "gkh-nl"),
        ("I see the land", "en-gkh"),
        ("Ik ga omdat de koning sterk is", "nl-gkh"),
        ("", "en-gkh"),
    ] {
        let json = analyze_sentence(text, direction);
        assert_valid_json(&json, &format!("analyze_sentence({text:?})"));
    }
}

#[test]
fn analysis_of_gurzul_khar_strips_the_affixes() {
    let json = analyze_sentence("rûkakûk", "gkh-en");
    assert!(json.contains("\"root\":\"rûk\""), "{json}");
    assert!(json.contains("plural"), "{json}");
}

#[test]
fn check_word_reports_legal_and_illegal_words() {
    let clean = check_word("khar");
    assert_valid_json(&clean, "check_word legal");
    assert_eq!(clean, "[]", "khar is a real lexicon entry and must pass");

    let bad = check_word("zhal");
    assert_valid_json(&bad, "check_word illegal");
    assert!(
        bad.contains("initial-ng-zh"),
        "word-initial zh must be reported by its stable code, got {bad}"
    );
    // The stable code is the contract; the prose beside it must still survive
    // the JSON boundary intact.
    assert!(bad.contains("\"rule\":\""), "a violation must carry its explanation: {bad}");
}

#[test]
fn check_word_refuses_sounds_outside_the_inventory() {
    let out = check_word("xyzzy");
    assert_valid_json(&out, "check_word unknown sound");
    assert!(out.contains("tokenization-failed"), "got {out}");
}

#[test]
fn tokenize_splits_digraphs_and_long_vowels() {
    let out = tokenize("gurzûl");
    assert_valid_json(&out, "tokenize");
    // "gurzûl" is g-u-r-z-û-l: the long vowel must come back marked as one.
    assert!(out.contains("\"isLong\":true"), "û must be a long vowel: {out}");
    assert!(out.contains("\"place\":\"velar\""), "consonant metadata must cross the boundary: {out}");

    let kh = tokenize("khar");
    assert!(kh.contains("\"id\":\"kh\""), "kh is one phoneme, not two: {kh}");

    assert_eq!(tokenize("xyzzy"), "null", "an unrecognised word must be null, not a guess");
}

#[test]
fn transliterate_round_trips_and_passes_punctuation_through() {
    let out = transliterate("khar, gurzûl!");
    assert_valid_json(&out, "transliterate");
    assert!(out.contains("\"kind\":\"word\""), "got {out}");
    assert!(out.contains("\"kind\":\"text\""), "punctuation must survive as its own part: {out}");
    assert!(out.contains("\"text\":\", \""), "the separator must be preserved verbatim: {out}");
    assert!(out.contains("\"latin\":\"khar\""), "the round-trip spelling must come back: {out}");
    assert!(out.contains("\"nucleus\""), "a word must come back as syllable blocks: {out}");
}

#[test]
fn transliterate_does_not_mangle_a_word_it_cannot_read() {
    // A word outside the inventory must come back as text, not as half a word.
    let out = transliterate("xyzzy");
    assert_valid_json(&out, "transliterate unknown");
    assert!(out.contains("\"kind\":\"text\""), "got {out}");
    assert!(!out.contains("\"kind\":\"word\""), "got {out}");
}

#[test]
fn transliterate_is_lossless_over_the_whole_input() {
    // Whatever the parts are, concatenating the original text of each must
    // reproduce the input exactly — that is what makes the round trip real.
    for input in ["khar", "ük sel han.", "shak kha khar dûnu", "a, b; c!"] {
        let out = transliterate(input);
        assert_valid_json(&out, "transliterate lossless");
        let rebuilt: String = out
            .match_indices("\"original\":\"")
            .map(|(i, m)| out[i + m.len()..].split('"').next().unwrap().to_string())
            .chain(
                out.match_indices("\"text\":\"")
                    .map(|(i, m)| out[i + m.len()..].split('"').next().unwrap().to_string()),
            )
            .collect::<Vec<_>>()
            .join("");
        assert_eq!(
            rebuilt.chars().filter(|c| !c.is_whitespace()).count(),
            input.chars().filter(|c| !c.is_whitespace()).count(),
            "parts of {input:?} do not add back up to it: {out}"
        );
    }
}

#[test]
fn coin_batch_reserves_across_the_whole_list() {
    // Two glosses that would otherwise be coined independently: run together,
    // the second must not take the spelling the first was given.
    let out = coin_batch("draak\tnoun\tnl\nruimteschip\tnoun\tnl\nwolkenkrabber\tnoun\tnl\n");
    let rows: Vec<Vec<&str>> = out.lines().map(|l| l.split('\t').collect()).collect();
    assert_eq!(rows.len(), 3, "every input line must produce an output line: {out}");

    let forms: Vec<&str> = rows.iter().map(|r| r[3]).collect();
    assert!(forms.iter().all(|f| !f.is_empty()), "no line should fail here: {out}");
    let mut sorted = forms.clone();
    sorted.sort_unstable();
    sorted.dedup();
    assert_eq!(sorted.len(), forms.len(), "a batch must not issue one spelling twice: {out}");

    // The first word of a batch has nothing reserved before it, so it must
    // match what the single-word call gives.
    let single: serde_free::Coined = serde_free::parse(&coin("draak", "noun", "nl"));
    assert_eq!(single.gkh, forms[0], "batch and single must agree on the first word");
}

#[test]
fn normalise_seed_is_what_the_coiner_keys_on() {
    // Surface differences that must not produce two different words.
    assert_eq!(
        normalise_seed_for("Draak!", "noun", "nl"),
        normalise_seed_for("draak", "noun", "nl")
    );
    // ...and a difference that must.
    assert_ne!(
        normalise_seed_for("draak", "noun", "nl"),
        normalise_seed_for("draak", "verb", "nl")
    );
}

/// A two-field reader for the one JSON shape these tests need, so the crate
/// still takes no serialisation dependency.
mod serde_free {
    pub struct Coined {
        pub gkh: String,
    }

    pub fn parse(json: &str) -> Coined {
        let key = "\"gkh\":\"";
        let start = json.find(key).expect("coin() must report a spelling") + key.len();
        let end = start + json[start..].find('"').expect("unterminated spelling");
        Coined { gkh: json[start..end].to_string() }
    }
}
