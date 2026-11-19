import { Link } from "react-router-dom";
import { lexicon } from "@engine/data.js";

export default function Home() {
  return (
    <div>
      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h1>GURZÛL KHAR</h1>
        <p>
          An independent constructed language inspired by the linguistic atmosphere of Tolkien's Black Speech and
          Mordor — with its own original phonology, writing system (the Khargûl script), grammar and vocabulary.
          GURZÛL KHAR is a fan creation: it is not an authentic Tolkien language and is not endorsed by the Tolkien
          Estate or any rights holder.
        </p>
        <p>
          <Link to="/translator">Open the translator →</Link> &nbsp;·&nbsp; <Link to="/learn">Start learning →</Link>
        </p>
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h2>What this is</h2>
          <p>
            A complete, internally consistent conlang: an original consonant/vowel inventory, a procedurally
            generated writing system, a documented grammar (nouns, verbs, adjectives, pronouns, syntax), and a
            deterministic rule-based translation engine covering English, Dutch and Gurzûl Khar.
          </p>
        </div>
        <div className="card">
          <h2>Current scope</h2>
          <p>
            The lexicon currently has <strong>{lexicon.entries.length}</strong> entries (project target: 500–1000 —
            see <Link to="/about">About</Link> for the honest status of what is and isn't finished yet). The
            translator supports a clearly scoped grammatical subset; unsupported input is reported honestly rather
            than guessed.
          </p>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h2>Explore</h2>
          <ul>
            <li>
              <Link to="/dictionary">Dictionary</Link> — search the lexicon in English, Dutch or Gurzûl Khar.
            </li>
            <li>
              <Link to="/grammar">Grammar reference</Link> — rendered directly from the language data.
            </li>
            <li>
              <Link to="/alphabet">Alphabet</Link> — the Khargûl script, procedurally generated.
            </li>
            <li>
              <Link to="/pronunciation">Pronunciation</Link> — IPA chart and stress rules.
            </li>
          </ul>
        </div>
        <div className="card">
          <h2>Lore</h2>
          <p>
            Within the project's fictional world, Gurzûl Khar is a regional dialect of Black Speech. Read its
            invented history on the <Link to="/lore">Lore page</Link> — clearly presented as fictional worldbuilding.
          </p>
        </div>
      </section>
    </div>
  );
}
