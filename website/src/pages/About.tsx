export default function About() {
  return (
    <div>
      <h1>About &amp; Contribute</h1>

      <section className="card">
        <h2>Mission</h2>
        <p>
          GURZÛL KHAR aims to be a complete, internally consistent constructed language — not just a handful of
          fantasy words — with its own phonology, writing system, grammar, vocabulary, and a working deterministic
          translation engine, taught through a real public learning platform.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Development philosophy</h2>
        <ul>
          <li>Every linguistic fact lives in one place (<code>/data</code>) and is never duplicated.</li>
          <li>Nothing is claimed to work unless it is implemented and tested.</li>
          <li>Unsupported translations fail honestly with an explanation, rather than guessing.</li>
          <li>Synthetic speech is always labelled as an approximation, never presented as authentic audio.</li>
          <li>Incomplete features (e.g. Levels 2–5 of the course) are shown as an honest roadmap, not hidden behind
            non-functional buttons.</li>
        </ul>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Status</h2>
        <p>
          See <a href="https://github.com/" target="_blank" rel="noreferrer">the GitHub repository</a>'s{" "}
          <code>BACKLOG.md</code> for the current, honestly maintained checklist of what is and isn't finished, and{" "}
          <code>DESIGN_DECISIONS.md</code> for the log of linguistic and architectural decisions and their rationale.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Contributing</h2>
        <p>
          Use the live <a href="#/propose">Propose a word</a> page to coin new vocabulary or ask the engine to suggest
          a phonotactically valid candidate; pending proposals are reviewed on the{" "}
          <a href="#/admin">review tool</a> (local dev server only — see BACKLOG.md §2). For grammar refinements or
          lessons, see <code>docs/CONTRIBUTING.md</code> in the repository. All linguistic changes go through the{" "}
          <code>/data</code> JSON files.
        </p>
        <p>
          Licensing approach: <code>docs/LICENSE_NOTES.md</code>.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Independence</h2>
        <p>
          GURZÛL KHAR is an independent fan creation inspired by Tolkien's Black Speech and the atmosphere of
          Mordor. It is not an authentic Tolkien language, and is not endorsed by, or affiliated with, the Tolkien
          Estate or any rights holder. No copyrighted Tolkien vocabulary or writing system is reproduced in this
          project.
        </p>
      </section>
    </div>
  );
}
