import { grammar } from "@engine/data.js";

function Kv({ data }: { data: Record<string, string> }) {
  return (
    <table>
      <tbody>
        {Object.entries(data).map(([k, v]) => (
          <tr key={k}>
            <th style={{ width: "40%" }}>{k}</th>
            <td>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Grammar() {
  return (
    <div>
      <h1>Grammar reference</h1>
      <p className="notice">
        This page is rendered directly from <code>data/morphology/grammar.json</code> (version {grammar.version}) —
        nothing here is a hand-written duplicate; the translator and this reference always agree because they read
        the same file.
      </p>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Typology</h2>
        <p>
          Word order: <strong>{grammar.typology.wordOrder}</strong> ({grammar.typology.morphologicalType})
        </p>
        <p className="notice">{grammar.typology.designNote}</p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Pronouns</h2>
        <h3>Subject forms</h3>
        <Kv data={grammar.pronouns.subjectForms} />
        <h3>Possessive suffixes</h3>
        <Kv data={grammar.pronouns.possessiveSuffixes} />
        <h3>Demonstratives</h3>
        <Kv data={grammar.pronouns.demonstratives} />
        <h3>Interrogatives</h3>
        <Kv data={grammar.pronouns.interrogatives} />
        <p>
          <strong>Reflexive:</strong> {grammar.pronouns.reflexive}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Nouns</h2>
        <p>
          <strong>Plural suffix:</strong> {grammar.nouns.pluralSuffix} — {grammar.nouns.pluralRule}
        </p>
        <p>
          <strong>Definiteness:</strong> {grammar.nouns.definiteness}
        </p>
        <h3>Possession</h3>
        <p>
          Strategy: {grammar.nouns.possession.strategy} (marker "{grammar.nouns.possession.marker}"), pattern:{" "}
          <code>{grammar.nouns.possession.pattern}</code>
        </p>
        <p>Example: {grammar.nouns.possession.example}</p>
        <p className="notice">{grammar.nouns.possession.pronominalAlternative}</p>
        <p>
          <strong>Compounding:</strong> {grammar.nouns.compounding}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Verbs</h2>
        <p>
          <strong>Citation form:</strong> {grammar.verbs.citationForm}
        </p>
        <h3>Tense suffixes</h3>
        <Kv data={grammar.verbs.tenseSuffixes} />
        <p>
          <strong>Imperative:</strong> {grammar.verbs.imperative}
        </p>
        <p>
          <strong>Negation:</strong> particle "{grammar.verbs.negation.particle}" — {grammar.verbs.negation.position}
        </p>
        <h3>Aspect</h3>
        <p>
          <strong>Habitual:</strong> {grammar.verbs.aspect.habitual}
        </p>
        <p>
          <strong>Progressive:</strong> {grammar.verbs.aspect.progressive}
        </p>
        <h3>Mood</h3>
        <Kv data={grammar.verbs.mood} />
        <h3>Auxiliaries</h3>
        <Kv data={grammar.verbs.auxiliaries} />
        <h3>Irregulars</h3>
        <ul>
          {grammar.verbs.irregulars.map((irr: any, i: number) => (
            <li key={i}>
              <strong>{irr.root}</strong> ({irr.gloss}): {irr.note}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Adjectives &amp; adverbs</h2>
        <p>
          <strong>Position:</strong> {grammar.adjectives.position} · <strong>Agreement:</strong>{" "}
          {grammar.adjectives.agreement}
        </p>
        <p>
          <strong>Comparative:</strong> marker "{grammar.adjectives.comparative.marker}", {grammar.adjectives.comparative.position} — e.g. {grammar.adjectives.comparative.example}
        </p>
        <p>
          <strong>Superlative:</strong> {grammar.adjectives.superlative.marker} — e.g. {grammar.adjectives.superlative.example}
        </p>
        <p>
          <strong>Intensification:</strong> marker "{grammar.adjectives.intensification.marker}" — e.g. {grammar.adjectives.intensification.example}
        </p>
        <p>
          <strong>Adverb formation:</strong> {grammar.adverbs.formation}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Numerals</h2>
        <Kv data={grammar.numerals.cardinal} />
        <p className="notice">
          Ordinal suffix: {grammar.numerals.ordinalSuffix}. Position: {grammar.numerals.position}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Syntax</h2>
        <table>
          <tbody>
            {(
              [
                ["Declarative", grammar.syntax.declarative],
                ["Negative", grammar.syntax.negative],
                ["Yes/no question", grammar.syntax.yesNoQuestion],
                ["Content question", grammar.syntax.contentQuestion],
                ["Imperative", grammar.syntax.imperative],
                ["Conditional", grammar.syntax.conditional],
                ["Relative clause", grammar.syntax.relativeClause],
                ["Relative clause — scope", (grammar.syntax as Record<string, string>).relativeClauseNote],
                ["Postpositional phrase", (grammar.syntax as Record<string, string>).postpositionalPhrase],
                ["Modal", (grammar.syntax as Record<string, string>).modal],
              ].filter(([, pattern]) => Boolean(pattern)) as [string, string][]
            ).map(([label, pattern]) => (
              <tr key={label}>
                <th style={{ width: "30%" }}>{label}</th>
                <td>{pattern}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Coordination &amp; subordination</h3>
        <Kv data={grammar.syntax.coordination} />
        <Kv data={grammar.syntax.subordination} />
        <h3>Examples</h3>
        <p>
          Compound: <code>{grammar.syntax.compoundSentenceExample}</code>
        </p>
        <p>
          Complex: <code>{grammar.syntax.complexSentenceExample}</code>
        </p>
      </section>
    </div>
  );
}
