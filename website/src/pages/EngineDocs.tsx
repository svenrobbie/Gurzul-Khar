export default function EngineDocs() {
  return (
    <div>
      <h1>How the translation engine works</h1>
      <p>
        This page describes the <em>actual</em> pipeline implemented in <code>engine/</code> — not an idealised
        version of it. The engine is deterministic: the same input, against the same version of the language data in
        <code>/data</code>, always produces the same output.
      </p>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>0. Two implementations, one specification</h2>
        <p>
          The pipeline below exists twice: in TypeScript under <code>engine/</code>, and in Rust under{" "}
          <code>crates/gkh-core</code>. The Rust crate is the one that will eventually run here (compiled to
          WebAssembly) and in the Android app, so that a bug fixed in the translator is fixed on every platform at
          once rather than drifting between two codebases.
        </p>
        <p>
          They are kept in agreement by data, not by review: the inputs and expected outputs live in
          <code>tests/fixtures/*.json</code>, and both test suites assert the same files. A divergence fails a build.
          The Rust crate has no dependencies and reads no files at runtime — the JSON in <code>/data</code> is
          generated into Rust constants at build time, so <code>/data</code> stays the single source of truth for
          both engines.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>1. Tokenize</h2>
        <p>
          The input sentence is split into words (<code>engine/morphology/tokenizer.ts</code>), punctuation is
          separated out, and a trailing "?" is noted as a yes/no-question marker.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>2. Analyze</h2>
        <p>
          <strong>Gurzûl Khar input</strong> is run through <code>engine/morphology/analyzer.ts</code>, which strips
          known affixes — plural <code>-ûk</code>/<code>-akûk</code>, tense suffixes, possessive suffixes, the
          reflexive suffix, and the derivational suffixes <code>-dûm</code>/<code>-ith</code>/<code>-ûl</code> — in a
          fixed priority order, always checking the stripped root against the lexicon. Every suffix string it checks
          is read from <code>data/morphology/grammar.json</code> and <code>data/lexicon/lexicon.json</code>; none is
          duplicated in the code.
        </p>
        <p>
          <strong>English/Dutch input</strong> is matched against a small set of closed-class words (pronouns,
          question words, negation, auxiliaries — ordinary EN/NL vocabulary, not conlang data) and against the
          lexicon's own <code>en</code>/<code>nl</code> fields.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>3. Transform</h2>
        <p>
          The analyzed words are assembled into a single internal <em>Clause</em> structure (subject, verb with
          tense, object, negation, question type, possession, comparison) shared by all four translation directions.
          Coordinated clauses ("and"/"or"/"but" ⇄ <code>ag</code>/<code>vo</code>/<code>nâth</code>) and complex
          sentences (the complementiser <code>sû</code>) are split into sub-clauses and recombined after each is
          translated.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>4. Generate</h2>
        <p>
          The Clause is rendered into surface words for the target language. For Gurzûl Khar output, affixes and
          word order are generated purely from the grammar rules (e.g. a question word is always fronted; the
          negation particle <code>na</code> always precedes the finite verb). For English/Dutch output, a documented,
          intentionally non-exhaustive set of surface rules produces readable prose.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>5. Native script &amp; pronunciation</h2>
        <p>
          When the target is Gurzûl Khar, the Latin output is tokenized into phonemes
          (<code>engine/phonology/phonemes.ts</code>), grouped into syllables by the phonotactic rules in
          <code>data/phonology/phonology.json</code> (<code>engine/phonology/syllabify.ts</code>), and rendered to
          inline SVG glyphs (<code>engine/phonology/glyphGenerator.ts</code>) following the construction rules in
          <code>data/orthography/alphabet.json</code>. The same syllabification also drives stress placement for the
          IPA pronunciation string.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>6. Honesty about limits</h2>
        <p>
          If a word isn't in the lexicon, or the sentence doesn't match a supported pattern, the engine returns a
          clear failure with an explanation — it never silently guesses a translation. This matches the Master
          Development Specification's requirement (§7.3/§7.6) to never claim a degree of accuracy the system doesn't
          actually have.
        </p>
      </section>
    </div>
  );
}
