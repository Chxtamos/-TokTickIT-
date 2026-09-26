import { useEffect, useRef, useState } from "react";
import {
  getInternalNotes,
  getPublicComments,
  postInternalNote,
  postPublicComment,
  type ApiValidationError,
  type ConversationEntry,
} from "./api.js";

type ConversationKind = "public" | "internal";

export function TicketConversation({ ticketId, kind }: { ticketId: number; kind: ConversationKind }) {
  const isPublic = kind === "public";
  const headingId = isPublic ? `public-comments-${ticketId}` : `internal-notes-${ticketId}`;
  const [items, setItems] = useState<ConversationEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError(null);
    const load = isPublic ? getPublicComments(ticketId) : getInternalNotes(ticketId);
    load.then((entries) => {
      if (!cancelled) {
        setItems(entries);
        setState("ready");
      }
    }).catch((cause) => {
      if (!cancelled) {
        setState("error");
        setError(cause instanceof Error ? cause.message : `Unable to load ${isPublic ? "Public Comments" : "Internal Notes"}.`);
      }
    });
    return () => { cancelled = true; };
  }, [ticketId, isPublic, retryToken]);

  async function submit() {
    const trimmed = draft.trim();
    if (trimmed.length < 1 || trimmed.length > 5000) {
      setDraftError("Enter 1 to 5,000 characters.");
      textareaRef.current?.focus();
      return;
    }
    setDraftError(null);
    setPostMessage(null);
    setPosting(true);
    try {
      const entry = isPublic
        ? await postPublicComment(ticketId, draft)
        : await postInternalNote(ticketId, draft);
      setItems((current) => [...current, entry].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id));
      setDraft("");
      setPostMessage({ kind: "success", text: isPublic ? "Public Comment posted." : "Internal Note saved." });
    } catch (cause) {
      const apiError = cause as ApiValidationError;
      if (apiError.statusCode === undefined) {
        setPostMessage({ kind: "warning", text: "The save result could not be confirmed. The list was reloaded; check whether your entry appears before manually retrying." });
        setRetryToken((token) => token + 1);
      } else {
        setPostMessage({ kind: "error", text: apiError.message || `Unable to save ${isPublic ? "Public Comment" : "Internal Note"}.` });
        if (apiError.fieldErrors?.content?.[0]) setDraftError(apiError.fieldErrors.content[0]);
      }
    } finally {
      setPosting(false);
    }
  }

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <section className={`detail-card conversation-card ${isPublic ? "conversation-public" : "conversation-private"}`} aria-labelledby={headingId} aria-busy={state === "loading" || posting}>
    <div className="conversation-heading">
      <div>
        <h2 id={headingId}>{isPublic ? "Public Comments" : "Internal Notes"}</h2>
        <p className="conversation-visibility">{isPublic ? "Visible to the Requester" : <><span className="privacy-icon" aria-hidden="true">{"\uD83D\uDD12"}</span> Internal Note - visible only to IT Staff and Administrators</>}</p>
      </div>
    </div>
    {state === "loading" && <p className="loading-message" role="status">Loading {isPublic ? "Public Comments" : "Internal Notes"}...</p>}
    {state === "error" && <div className="alert alert-error" role="alert">{error}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button></div>}
    {state === "ready" && items.length === 0 && <p className="empty-detail" role="status">No {isPublic ? "Public Comments" : "Internal Notes"} yet.</p>}
    {state === "ready" && items.length > 0 && <ol className="conversation-list" aria-label={isPublic ? "Public Comments" : "Internal Notes"}>{items.map((entry) => <li key={entry.id}>
      <div className="conversation-meta"><strong>{entry.author.name}</strong><span className="queue-badge">{entry.author.role.replaceAll("_", " ")}</span><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></div>
      <p className="conversation-content">{entry.content}</p>
    </li>)}</ol>}
    <div className="conversation-composer">
      <label htmlFor={`${kind}-conversation-${ticketId}`}>{isPublic ? "Public Comment" : "Internal Note"}</label>
      <textarea ref={textareaRef} id={`${kind}-conversation-${ticketId}`} value={draft} maxLength={5000} disabled={posting} aria-invalid={Boolean(draftError)} aria-describedby={`${kind}-conversation-hint-${ticketId}${draftError ? ` ${kind}-conversation-error-${ticketId}` : ""}`} onChange={(event) => { setDraft(event.target.value); setDraftError(null); setPostMessage(null); }} />
      <small id={`${kind}-conversation-hint-${ticketId}`}>{draft.length}/5,000 characters. Content is shown as plain text.</small>
      {draftError && <small id={`${kind}-conversation-error-${ticketId}`} className="field-error">{draftError}</small>}
      {postMessage && <div className={`alert ${postMessage.kind === "success" ? "alert-success" : postMessage.kind === "warning" ? "alert-warning" : "alert-error"}`} role={postMessage.kind === "error" ? "alert" : "status"}>{postMessage.text}</div>}
      <button type="button" className="button button-primary conversation-submit" disabled={posting} onClick={submit}>{posting ? (isPublic ? "Posting..." : "Saving...") : (isPublic ? "Post Public Comment" : "Save Internal Note")}</button>
    </div>
  </section>;
}
