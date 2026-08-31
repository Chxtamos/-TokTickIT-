import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createTicket, CreatedTicket, DevelopmentRequester, getCategories, getDevelopmentRequesters, getRelatedSystems, ReferenceItem, uploadTicketAttachment } from "./api.js";
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

type CreateScreenProps = { requester: DevelopmentRequester; onBack: () => void };
type SelectedFile = { file: File; error?: string };

function CreateTicketScreen({ requester, onBack }: CreateScreenProps) {
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([]);
  const [referenceState, setReferenceState] = useState<"loading" | "ready" | "error">("loading");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRetryToken, setReferenceRetryToken] = useState(0);
  const [form, setForm] = useState({ categoryId: "", relatedSystemId: "", requestedPriority: "MEDIUM", summary: "", description: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [ticket, setTicket] = useState<CreatedTicket | null>(null);
  const [attachmentResults, setAttachmentResults] = useState<{ name: string; ok: boolean; message?: string }[]>([]);
  const [failedUploadFiles, setFailedUploadFiles] = useState<File[]>([]);
  const [retryingAttachments, setRetryingAttachments] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setReferenceState("loading");
    setReferenceError(null);
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([loadedCategories, loadedSystems]) => { setCategories(loadedCategories); setRelatedSystems(loadedSystems); setReferenceState("ready"); })
      .catch(() => { setCategories([]); setRelatedSystems([]); setReferenceState("error"); setReferenceError("Unable to load Ticket reference data. Please try again."); });
  }, [referenceRetryToken]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const next = selected.slice(0, 5).map((file) => {
      const extension = file.name.toLowerCase().split(".").pop();
      const validType = ["jpg", "jpeg", "png", "webp", "pdf"].includes(extension ?? "");
      if (!validType) return { file, error: "Unsupported file type." };
      if (file.size > 5_242_880) return { file, error: "File exceeds 5 MiB." };
      return { file };
    });
    if (selected.length > 5) next.push({ file: selected[5], error: "Maximum five files can be selected." });
    setFiles(next);
    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!form.categoryId) errors.categoryId = "Category is required.";
    if (!form.relatedSystemId) errors.relatedSystemId = "Related System is required.";
    if (form.summary.trim().length < 5 || form.summary.trim().length > 120) errors.summary = "Summary must contain 5 to 120 characters.";
    if (form.description.trim().length < 10 || form.description.trim().length > 5000) errors.description = "Description must contain 10 to 5,000 characters.";
    setFieldErrors(errors);
    const firstInvalid = ["categoryId", "relatedSystemId", "summary", "description"].find((field) => errors[field]);
    if (firstInvalid) window.setTimeout(() => document.getElementById(firstInvalid)?.focus(), 0);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateForm()) return;
    setSubmitState("submitting");
    setSubmitError(null);
    setAttachmentResults([]);
    setFailedUploadFiles([]);
    try {
      const created = await createTicket(requester.id, {
        clientRequestId: globalThis.crypto.randomUUID(),
        categoryId: Number(form.categoryId),
        relatedSystemId: Number(form.relatedSystemId),
        requestedPriority: form.requestedPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        summary: form.summary.trim(),
        description: form.description.trim(),
      });
      setTicket(created.ticket);
      const results = await Promise.all(files.filter((item) => !item.error).map(async ({ file }) => {
        try { await uploadTicketAttachment(requester.id, created.ticket.id, file); return { name: file.name, ok: true }; }
        catch (error) { return { name: file.name, ok: false, message: error instanceof Error ? error.message : "Upload failed." }; }
      }));
      setAttachmentResults([...files.filter((item) => item.error).map(({ file, error }) => ({ name: file.name, ok: false, message: error })), ...results]);
      setFailedUploadFiles(files.filter((item) => !item.error).map(({ file }, index) => results[index]?.ok ? null : file).filter((file): file is File => file !== null));
      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      const apiError = error as { message?: string; fieldErrors?: Record<string, string[]> };
      setSubmitError(apiError.message ?? "Unable to create Ticket. Please try again.");
      if (apiError.fieldErrors) setFieldErrors(Object.fromEntries(Object.entries(apiError.fieldErrors).map(([key, messages]) => [key, messages[0]])));
    }
  }

  async function retryFailedAttachments() {
    if (!ticket || failedUploadFiles.length === 0) return;
    setRetryingAttachments(true);
    const retryResults = await Promise.all(failedUploadFiles.map(async (file) => {
      try { await uploadTicketAttachment(requester.id, ticket.id, file); return { name: file.name, ok: true }; }
      catch (error) { return { name: file.name, ok: false, message: error instanceof Error ? error.message : "Upload failed." }; }
    }));
    setAttachmentResults((current) => current.map((result) => retryResults.find((retry) => retry.name === result.name) ?? result));
    setFailedUploadFiles(failedUploadFiles.filter((file, index) => !retryResults[index].ok));
    setRetryingAttachments(false);
  }

  if (submitState === "success" && ticket) return (
    <main className="shell-content" id="create-ticket">
      <div className="alert alert-success" role="status"><h1>Ticket created</h1><p>Official Ticket Number: <strong>{ticket.ticketNumber}</strong></p></div>
      {attachmentResults.length > 0 && <section className="context-card"><h2>Attachment results</h2><ul>{attachmentResults.map((result) => <li key={result.name}>{result.name}: {result.ok ? "Uploaded" : result.message}</li>)}</ul>{failedUploadFiles.length > 0 && <button className="button button-secondary" type="button" onClick={retryFailedAttachments} disabled={retryingAttachments}>{retryingAttachments ? "Retrying uploads…" : "Retry failed uploads"}</button>}</section>}
      <button className="button button-secondary" onClick={onBack}>Back to workspace</button>
    </main>
  );

  return (
    <main className="shell-content" id="create-ticket">
      <button className="back-button" onClick={onBack}>← Back to workspace</button>
      <p className="eyebrow">Requester workspace</p>
      <h1>Create Ticket</h1>
      <p className="intro">Describe your IT request. Fields marked <span aria-hidden="true">*</span> are required.</p>
      {referenceState === "loading" && <div className="alert" role="status">Loading Ticket reference data…</div>}
      {referenceError && <div className="alert alert-error" role="alert">{referenceError}<button className="button button-secondary retry-button" type="button" onClick={() => setReferenceRetryToken((token) => token + 1)}>Retry</button></div>}
      {submitError && <div className="alert alert-error" role="alert">{submitError}<button className="button button-secondary retry-button" type="button" onClick={() => { setSubmitError(null); setSubmitState("idle"); }}>Retry</button></div>}
      <form className="ticket-form" onSubmit={submit} noValidate aria-busy={referenceState === "loading" || submitState === "submitting"}>
        <div className="readonly-grid"><label>Ticket Number<input value="Generated after submission" readOnly /></label><label>Ticket Date<input value="Recorded after submission" readOnly /></label><label>Requester<input value={requester.name} readOnly /></label></div>
        <div className="form-grid">
          <label htmlFor="category-id">Category <span aria-hidden="true">*</span><select id="category-id" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} disabled={referenceState !== "ready" || submitState === "submitting"} aria-invalid={Boolean(fieldErrors.categoryId)} aria-describedby={fieldErrors.categoryId ? "category-error" : undefined} required><option value="">Select Category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.categoryId && <small id="category-error" className="field-error">{fieldErrors.categoryId}</small>}</label>
          <label htmlFor="related-system-id">Related System <span aria-hidden="true">*</span><select id="related-system-id" value={form.relatedSystemId} onChange={(event) => updateField("relatedSystemId", event.target.value)} disabled={referenceState !== "ready" || submitState === "submitting"} aria-invalid={Boolean(fieldErrors.relatedSystemId)} aria-describedby={fieldErrors.relatedSystemId ? "related-system-error" : undefined} required><option value="">Select Related System</option>{relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.relatedSystemId && <small id="related-system-error" className="field-error">{fieldErrors.relatedSystemId}</small>}</label>
          <label htmlFor="requested-priority">Requested Priority <select id="requested-priority" value={form.requestedPriority} onChange={(event) => updateField("requestedPriority", event.target.value)} disabled={submitState === "submitting"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
        </div>
        <label htmlFor="summary">Summary <span aria-hidden="true">*</span><input id="summary" value={form.summary} maxLength={120} onChange={(event) => updateField("summary", event.target.value)} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.summary)} aria-describedby={fieldErrors.summary ? "summary-error summary-count" : "summary-count"} required />{fieldErrors.summary && <small id="summary-error" className="field-error">{fieldErrors.summary}</small>}<small id="summary-count">{form.summary.length}/120</small></label>
        <label htmlFor="description">Description <span aria-hidden="true">*</span><textarea id="description" value={form.description} maxLength={5000} onChange={(event) => updateField("description", event.target.value)} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error description-count" : "description-count"} required />{fieldErrors.description && <small id="description-error" className="field-error">{fieldErrors.description}</small>}<small id="description-count">{form.description.length}/5000</small></label>
        <label htmlFor="attachments">Attachments<input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={selectFiles} disabled={submitState === "submitting"} /><small>JPG, JPEG, PNG, WEBP, or PDF; maximum 5 MiB each; maximum 5 files</small></label>
        {files.length > 0 && <ul className="file-list">{files.map(({ file, error }, index) => <li key={`${file.name}-${file.lastModified}`}>{file.name} ({Math.ceil(file.size / 1024)} KiB){error && <span className="field-error"> — {error}</span>}<button type="button" className="file-remove" onClick={() => removeSelectedFile(index)} disabled={submitState === "submitting"}>Remove</button></li>)}</ul>}
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={onBack} disabled={submitState === "submitting"}>Cancel</button><button type="submit" className="button button-primary submit-button" disabled={submitState === "submitting"}>{submitState === "submitting" ? "Submitting…" : "Submit Ticket"}</button></div>
      </form>
    </main>
  );
}

function ApplicationShell({ requester, onChangeRequester }: { requester: DevelopmentRequester; onChangeRequester: () => void }) {
  const [screen, setScreen] = useState<"home" | "create">("home");
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#home">TokTickIT</a>
          <nav aria-label="Primary navigation">
            <a href="#home" aria-current="page">Workspace</a>
            <button className="nav-unavailable" type="button" disabled title="Available in a later Lab 2 feature">My Tickets <span>(coming soon)</span></button>
            <button className={screen === "create" ? "nav-create active" : "nav-create"} type="button" onClick={() => setScreen("create")} aria-current={screen === "create" ? "page" : undefined}>Create Ticket</button>
          </nav>
          <div className="requester-context">
            <span>Requester: {requester.name}</span>
            <button className="change-requester" onClick={onChangeRequester}>Change Requester</button>
          </div>
        </div>
      </header>
      {screen === "create" ? <CreateTicketScreen requester={requester} onBack={() => setScreen("home")} /> : <main className="shell-content" id="home">
        <p className="eyebrow">Requester workspace</p>
        <h1>Welcome to TokTickIT</h1>
        <p>Your requester context is ready. Choose an action from the navigation when the corresponding Lab 2 screen is available.</p>
        <div className="context-card" role="status">Testing as <strong>{requester.name}</strong></div>
      </main>}
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
