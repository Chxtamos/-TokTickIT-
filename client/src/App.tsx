import { useEffect, useState } from "react";
import { checkSystem, DevelopmentRequester, getDevelopmentRequesters } from "./api.js";
import "./App.css";

const REQUESTER_STORAGE_KEY = "toktickit.requesterId";
type RequesterLoadState = "loading" | "ready" | "empty" | "error";
type HealthState = "idle" | "loading" | "success" | "error";

function SystemCheck() {
  const [state, setState] = useState<HealthState>("idle");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  return (
    <section className="system-check" aria-labelledby="system-check-title">
      <h2 id="system-check-title">System connection</h2>
      <button className="button button-secondary" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading..." : "Check System"}
      </button>
      {state === "success" && (
        <div className="alert alert-success" role="status">
          <strong>System Status:</strong> Online
          <ul>{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ul>
        </div>
      )}
      {state === "error" && <div className="alert alert-error" role="alert"><strong>System Status:</strong> Offline<p>Unable to connect to TokTickIT API</p></div>}
    </section>
  );
}

function RequesterSelector({
  requesters,
  state,
  selectedId,
  onSelect,
  onContinue,
  onRetry,
  validating,
}: {
  requesters: DevelopmentRequester[];
  state: RequesterLoadState;
  selectedId: string;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onRetry: () => void;
  validating: boolean;
}) {
  return (
    <main className="selector-page" aria-busy={state === "loading" || validating}>
      <section className="selector-card" aria-labelledby="requester-title">
        <p className="eyebrow">TokTickIT · Lab 2</p>
        <h1 id="requester-title">Select a Development Requester</h1>
        <p className="intro">Choose a seeded requester for this Lab 2 test session. This is temporary testing context, not login or authentication.</p>
        {state === "loading" && <p className="loading-message" role="status">Loading Requesters…</p>}
        {state === "error" && (
          <div className="alert alert-error" role="alert">
            Unable to load Development Requesters. Please try again.
            <button className="button button-secondary retry-button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {state === "empty" && (
          <div className="alert alert-warning" role="status">
            No active Development Requesters are available.
            <button className="button button-secondary retry-button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {state === "ready" && (
          <>
            <label htmlFor="requester-select">Development Requester</label>
            <select id="requester-select" value={selectedId} onChange={(event) => onSelect(event.target.value)} disabled={validating}>
              <option value="">Select a requester…</option>
              {requesters.map((requester) => <option key={requester.id} value={requester.id}>{requester.name}</option>)}
            </select>
            <button className="button button-primary continue-button" onClick={onContinue} disabled={!selectedId || validating}>
              {validating ? "Validating…" : "Continue"}
            </button>
          </>
        )}
        <SystemCheck />
      </section>
    </main>
  );
}

function ApplicationShell({ requester, onChangeRequester }: { requester: DevelopmentRequester; onChangeRequester: () => void }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#home">TokTickIT</a>
          <nav aria-label="Primary navigation">
            <a href="#my-tickets">My Tickets</a>
            <a href="#create-ticket">Create Ticket</a>
          </nav>
          <div className="requester-context">
            <span>Requester: {requester.name}</span>
            <button className="change-requester" onClick={onChangeRequester}>Change Requester</button>
          </div>
        </div>
      </header>
      <main className="shell-content" id="home">
        <p className="eyebrow">Requester workspace</p>
        <h1>Welcome to TokTickIT</h1>
        <p>Your requester context is ready. Choose an action from the navigation when the corresponding Lab 2 screen is available.</p>
        <div className="context-card" role="status">Testing as <strong>{requester.name}</strong></div>
      </main>
    </div>
  );
}

export default function App() {
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [loadState, setLoadState] = useState<RequesterLoadState>("loading");
  const [selectedId, setSelectedId] = useState("");
  const [currentRequester, setCurrentRequester] = useState<DevelopmentRequester | null>(null);
  const [validating, setValidating] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    getDevelopmentRequesters()
      .then((loaded) => {
        if (cancelled) return;
        setRequesters(loaded);
        const storedId = sessionStorage.getItem(REQUESTER_STORAGE_KEY) ?? "";
        const restored = loaded.find((requester) => String(requester.id) === storedId);
        if (restored) {
          setSelectedId(String(restored.id));
          setCurrentRequester(restored);
        } else {
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setSelectedId("");
          setCurrentRequester(null);
        }
        setLoadState(loaded.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) {
          setRequesters([]);
          setCurrentRequester(null);
          setLoadState("error");
        }
      });
    return () => { cancelled = true; };
  }, [retryToken]);

  function handleContinue() {
    const requester = requesters.find((item) => String(item.id) === selectedId);
    if (!requester) return;
    setValidating(true);
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
    Promise.resolve().then(() => {
      setCurrentRequester(requester);
      setValidating(false);
    });
  }

  function handleChangeRequester() {
    sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    setCurrentRequester(null);
    setSelectedId("");
  }

  if (currentRequester) return <ApplicationShell requester={currentRequester} onChangeRequester={handleChangeRequester} />;
  return <RequesterSelector requesters={requesters} state={loadState} selectedId={selectedId} onSelect={setSelectedId} onContinue={handleContinue} onRetry={() => setRetryToken((token) => token + 1)} validating={validating} />;
}
