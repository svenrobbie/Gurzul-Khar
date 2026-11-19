import historyText from "../../../lore/history/history.md?raw";
import { renderSimpleMarkdown } from "../lib/markdown";

export default function Lore() {
  return (
    <div>
      <div className="error-box" style={{ marginBottom: "1rem" }}>
        Everything on this page is fictional worldbuilding created for this project. It is not Tolkien's own lore
        and claims no historical or textual authenticity.
      </div>
      <article className="card">{renderSimpleMarkdown(historyText)}</article>
    </div>
  );
}
