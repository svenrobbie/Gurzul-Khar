import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { initEngine } from "./engine";
import "./styles/global.css";

// The engine is loaded before the first render because WebAssembly
// instantiation is asynchronous while every call site in the app is not.
// A failure here is handled inside initEngine, which falls back to the
// TypeScript engine rather than leaving the page blank.
initEngine().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
});
