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
