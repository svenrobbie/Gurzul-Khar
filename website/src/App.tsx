import { NavLink, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Translator from "./pages/Translator";
import Dictionary from "./pages/Dictionary";
import Grammar from "./pages/Grammar";
import Alphabet from "./pages/Alphabet";
import { SHOW_NATIVE_SCRIPT } from "./features";
import Pronunciation from "./pages/Pronunciation";
import Learn from "./pages/Learn";
import Lore from "./pages/Lore";
import EngineDocs from "./pages/EngineDocs";
import About from "./pages/About";
import Propose from "./pages/Propose";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/translator", label: "Translator" },
  { to: "/dictionary", label: "Dictionary" },
  { to: "/propose", label: "Propose a word" },
  { to: "/grammar", label: "Grammar" },
  ...(SHOW_NATIVE_SCRIPT ? [{ to: "/alphabet", label: "Alphabet" }] : []),
  { to: "/pronunciation", label: "Pronunciation" },
  { to: "/learn", label: "Learn" },
  { to: "/lore", label: "Lore" },
  { to: "/engine", label: "Engine" },
  { to: "/about", label: "About" },
];

export default function App() {
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" className="brand" aria-label="GURZÛL KHAR home">
            <svg width="28" height="28" viewBox="0 0 40 100" aria-hidden="true">
              <line x1="20" y1="10" x2="20" y2="90" stroke="currentColor" strokeWidth="4" />
              <circle cx="26" cy="50" r="4" fill="currentColor" />
            </svg>
            GURZÛL KHAR
          </NavLink>
          <nav className="site-nav" aria-label="Main navigation">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/translator" element={<Translator />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/propose" element={<Propose />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/grammar" element={<Grammar />} />
          {SHOW_NATIVE_SCRIPT && <Route path="/alphabet" element={<Alphabet />} />}
          <Route path="/pronunciation" element={<Pronunciation />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/lore" element={<Lore />} />
          <Route path="/engine" element={<EngineDocs />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        GURZÛL KHAR is an independent fan-made constructed language. Not affiliated with or endorsed by the Tolkien
        Estate or any rights holder. See{" "}
        <a href="https://github.com/" target="_blank" rel="noreferrer">
          the project repository
        </a>{" "}
        and <NavLink to="/about">About &amp; Contribute</NavLink>.
      </footer>
    </div>
  );
}
