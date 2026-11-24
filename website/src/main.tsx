import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { initEngine, engineFailure } from "./engine";
import "./styles/global.css";

// The engine is loaded before the first render because WebAssembly
// instantiation is asynchronous while every call site in the app is not.
//
// There is one engine and no fallback, so if it does not load the site cannot
// translate, render native script or check a spelling. That is said plainly
// rather than left as a blank page or a scattering of broken panels.
initEngine().finally(() => {
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  const failure = engineFailure();

  if (failure) {
    root.render(
      <main style={{ maxWidth: "42rem", margin: "4rem auto", padding: "0 1rem" }}>
        <h1>The language engine did not load</h1>
        <p>
          Gurzûl Khar runs on a Rust core compiled to WebAssembly. The browser could not start it, so
          nothing on this site that depends on the language will work.
        </p>
        <p>
          If you are running this locally, the most likely cause is that the engine has not been built
          yet: <code>npm run build:wasm</code>.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{failure.message}</pre>
      </main>,
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
});
