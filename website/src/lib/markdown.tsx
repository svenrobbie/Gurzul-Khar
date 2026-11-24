import React from "react";

/** Minimal, dependency-free renderer for the small subset of Markdown used in our own lore/docs files (headings, paragraphs, numbered/bulleted lists, bold, italics, inline code). Not a general Markdown parser. */
export function renderSimpleMarkdown(source: string): React.ReactNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listOrdered = false;
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, i) => <li key={i}>{inline(item)}</li>);
    nodes.push(listOrdered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
    listBuffer = [];
  }

  function inline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*.+?\*\*|\*.+?\*|`.+?`)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
      return p;
    });
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      nodes.push(<h1 key={key++}>{inline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      flushList();
      nodes.push(<h2 key={key++}>{inline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      flushList();
      nodes.push(<h3 key={key++}>{inline(line.slice(4))}</h3>);
    } else if (/^\d+\.\s/.test(line)) {
      listOrdered = true;
      listBuffer.push(line.replace(/^\d+\.\s/, ""));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listOrdered = false;
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      flushList();
      nodes.push(
        <p key={key++} className="notice">
          {line.slice(1, -1)}
        </p>
      );
    } else {
      flushList();
      nodes.push(<p key={key++}>{inline(line)}</p>);
    }
  }
  flushList();
  return nodes;
}
