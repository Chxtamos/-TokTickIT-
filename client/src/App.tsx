import { useEffect, useState } from "react";
import { DevelopmentRequester, getDevelopmentRequesters } from "./api.js";
import "./App.css";

const REQUESTER_STORAGE_KEY = "toktickit.requesterId";
type RequesterLoadState = "loading" | "ready" | "empty" | "error";

function RequesterSelector({
  requesters,
  state,
  selectedId,
  onSelect,
  onContinue,
  onRetry,
  validating,
  selectionError,
}: {
  requesters: DevelopmentRequester[];
  state: RequesterLoadState;
  selectedId: string;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onRetry: () => void;
  validating: boolean;
  selectionError: string | null;
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
        {selectionError && <div className="alert alert-error" role="alert">{selectionError}</div>}
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
            <a href="#home" aria-current="page">Workspace</a>
            <button className="nav-unavailable" type="button" disabled title="Available in a later Lab 2 feature">My Tickets <span>(coming soon)</span></button>
            <button className="nav-unavailable" type="button" disabled title="Available in a later Lab 2 feature">Create Ticket <span>(coming soon)</span></button>
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
  const [selectionError, setSelectionError] = useState<string | null>(null);
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
    if (!requesters.some((item) => String(item.id) === selectedId)) return;
    setValidating(true);
    setSelectionError(null);
    getDevelopmentRequesters()
      .then((freshRequesters) => {
        setRequesters(freshRequesters);
        const requester = freshRequesters.find((item) => String(item.id) === selectedId);
        if (!requester) {
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setSelectedId("");
          setCurrentRequester(null);
          setLoadState(freshRequesters.length > 0 ? "ready" : "empty");
          setSelectionError("That Development Requester is no longer active. Please select another.");
          return;
        }
        sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
        setCurrentRequester(requester);
      })
      .catch(() => setSelectionError("Unable to validate the selected Requester. Please try again."))
      .finally(() => setValidating(false));
  }

  function handleChangeRequester() {
    sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    setCurrentRequester(null);
    setSelectedId("");
  }

  if (currentRequester) return <ApplicationShell requester={currentRequester} onChangeRequester={handleChangeRequester} />;
  return <RequesterSelector requesters={requesters} state={loadState} selectedId={selectedId} onSelect={(value) => { setSelectionError(null); setSelectedId(value); }} onContinue={handleContinue} onRetry={() => setRetryToken((token) => token + 1)} validating={validating} selectionError={selectionError} />;
}
