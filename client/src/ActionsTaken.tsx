import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTicketAction,
  getTicketActions,
  updateTicketAction,
  type ActionTaken,
  type ActionTakenStatus,
  type ApiValidationError,
  type AuthUser,
  type CreateTicketActionInput,
  type EligibleOwner,
  type UpdateTicketActionInput,
} from "./api.js";

type Draft = {
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
  status: ActionTakenStatus;
};

type FormMode =
  | { kind: "create"; clientRequestId: string }
  | { kind: "edit"; actionId: number; expectedVersion: number; originalStatus: ActionTakenStatus };

const NEXT_ACTION_STATUSES: Record<ActionTakenStatus, ActionTakenStatus[]> = {
  PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function createClientRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function emptyDraft(): Draft {
  return {
    description: "",
    result: "",
    assigneeId: "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
    status: "PENDING",
  };
}

function draftFromAction(action: ActionTaken): Draft {
  return {
    description: action.description,
    result: action.result ?? "",
    assigneeId: action.assignee ? String(action.assignee.id) : "",
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
    status: action.status,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function labelStatus(value: ActionTakenStatus): string {
  return value.replaceAll("_", " ");
}

function isTerminal(status: ActionTakenStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

function validateDraft(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const description = draft.description.trim();
  const result = draft.result.trim();
  const followUpNote = draft.followUpNote.trim();
  const attachmentNotes = draft.attachmentNotes.trim();
  if (description.length < 5 || description.length > 2000) errors.description = "Description must be 5 to 2,000 characters.";
  if (result.length > 2000) errors.result = "Result must be at most 2,000 characters.";
  if (attachmentNotes.length > 1000) errors.attachmentNotes = "Attachment notes must be at most 1,000 characters.";
  if (draft.followUpRequired && (followUpNote.length < 5 || followUpNote.length > 1000)) {
    errors.followUpNote = "Follow-up note must be 5 to 1,000 characters when follow-up is required.";
  }
  if (draft.status === "COMPLETED") {
    if (result.length < 5) errors.result = "Result must be at least 5 characters before completing an Action.";
    if (draft.followUpRequired) errors.status = "Complete the required follow-up before marking this Action COMPLETED.";
  }
  return errors;
}

export function ActionsTakenSection({
  ticketId,
  user,
  assignees,
}: {
  ticketId: number;
  user: AuthUser;
  assignees: EligibleOwner[];
}) {
  const operational = user.role === "IT_STAFF" || user.role === "ADMINISTRATOR";
  const [items, setItems] = useState<ActionTaken[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "conflict"; message: string } | null>(null);
  const requestGeneration = useRef(0);

  async function loadActions(preserveForm = false) {
    const generation = ++requestGeneration.current;
    if (preserveForm) setRefreshing(true);
    else {
      setState("loading");
      setLoadError(null);
    }
    try {
      const loaded = await getTicketActions(ticketId);
      if (generation !== requestGeneration.current) return;
      setItems(loaded);
      setState("ready");
      setLoadError(null);
      if (preserveForm && mode?.kind === "edit") {
        const authoritative = loaded.find((item) => item.id === mode.actionId);
        if (authoritative) {
          setMode({ kind: "edit", actionId: authoritative.id, expectedVersion: authoritative.version, originalStatus: authoritative.status });
        }
      }
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      const error = cause as ApiValidationError;
      if (preserveForm) {
        setFeedback({ kind: "error", message: error.message || "Unable to refresh Actions Taken." });
      } else {
        setState("error");
        setLoadError(error.message || "Unable to load Actions Taken.");
      }
    } finally {
      if (generation === requestGeneration.current) setRefreshing(false);
    }
  }

  useEffect(() => {
    requestGeneration.current += 1;
    setItems([]);
    setMode(null);
    setDraft(emptyDraft());
    setFieldErrors({});
    setFeedback(null);
    void loadActions(false);
    return () => {
      requestGeneration.current += 1;
    };
  }, [ticketId]);

  const editingAction = useMemo(
    () => mode?.kind === "edit" ? items.find((item) => item.id === mode.actionId) ?? null : null,
    [items, mode],
  );

  function openCreate() {
    setMode({ kind: "create", clientRequestId: createClientRequestId() });
    setDraft(emptyDraft());
    setFieldErrors({});
    setFeedback(null);
  }

  function openEdit(action: ActionTaken) {
    setMode({ kind: "edit", actionId: action.id, expectedVersion: action.version, originalStatus: action.status });
    setDraft(draftFromAction(action));
    setFieldErrors({});
    setFeedback(null);
  }

  function closeForm() {
    if (saving) return;
    setMode(null);
    setDraft(emptyDraft());
    setFieldErrors({});
    setFeedback(null);
  }

  function setDraftField<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "", ...(field === "followUpRequired" ? { status: "" } : {}) }));
  }

  function handleMutationError(cause: unknown) {
    const error = cause as ApiValidationError;
    if (error.fieldErrors) {
      setFieldErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([field, messages]) => [field, messages[0] ?? "Invalid value."])));
    }
    if (error.statusCode === 409 && error.code === "VERSION_CONFLICT") {
      setFeedback({ kind: "conflict", message: "The Action changed while you were editing. Refresh Actions and review your retained draft before saving again." });
    } else if (error.code === "ASSIGNEE_INELIGIBLE") {
      setFeedback({ kind: "error", message: "The selected assignee is no longer eligible. Your draft was retained." });
    } else if (error.code === "ACTION_TERMINAL") {
      setFeedback({ kind: "error", message: "This Action is now terminal and read-only. Refresh Actions to review the authoritative state." });
    } else {
      setFeedback({ kind: "error", message: error.message || "Unable to save Action Taken. Your draft was retained." });
    }
  }

  async function save() {
    if (!mode || !operational) return;
    const errors = validateDraft(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (mode.kind === "create") {
        const input: CreateTicketActionInput = {
          clientRequestId: mode.clientRequestId,
          description: draft.description.trim(),
          result: draft.result.trim() || null,
          assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null,
          followUpRequired: draft.followUpRequired,
          followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : null,
          attachmentNotes: draft.attachmentNotes.trim() || null,
        };
        const created = await createTicketAction(ticketId, input);
        setItems((current) => [...current.filter((item) => item.id !== created.action.id), created.action]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id));
        setMode(null);
        setDraft(emptyDraft());
        setFieldErrors({});
        setFeedback({ kind: "success", message: created.replayed ? "Action restored from the original request." : "Action saved." });
      } else {
        const input: UpdateTicketActionInput = {
          expectedVersion: mode.expectedVersion,
          description: draft.description.trim(),
          result: draft.result.trim() || null,
          assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null,
          followUpRequired: draft.followUpRequired,
          followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : null,
          attachmentNotes: draft.attachmentNotes.trim() || null,
          ...(draft.status !== mode.originalStatus ? { status: draft.status } : {}),
        };
        const updated = await updateTicketAction(ticketId, mode.actionId, input);
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
        setMode(null);
        setDraft(emptyDraft());
        setFieldErrors({});
        setFeedback({ kind: "success", message: "Action updated." });
      }
    } catch (cause) {
      handleMutationError(cause);
    } finally {
      setSaving(false);
    }
  }

  const currentAssigneeMissing = mode?.kind === "edit" && editingAction?.assignee
    && !assignees.some((owner) => owner.id === editingAction.assignee?.id)
    ? editingAction.assignee
    : null;
  const statusChoices = mode?.kind === "edit"
    ? [mode.originalStatus, ...NEXT_ACTION_STATUSES[mode.originalStatus]]
    : ["PENDING" as ActionTakenStatus];

  return (
    <section className="detail-card actions-taken-card" aria-labelledby={`actions-taken-heading-${ticketId}`} aria-busy={state === "loading" || saving || refreshing}>
      <div className="actions-section-heading">
        <div>
          <h2 id={`actions-taken-heading-${ticketId}`}>Actions Taken</h2>
          <p className="section-hint">Operational history is shown oldest first. Performer and creation time are recorded by the backend.</p>
        </div>
        {operational && !mode && <button type="button" className="button button-primary actions-add-button" onClick={openCreate}>Add Action</button>}
      </div>

      {feedback && <div className={`alert ${feedback.kind === "success" ? "alert-success" : feedback.kind === "conflict" ? "alert-warning" : "alert-error"}`} role={feedback.kind === "success" ? "status" : "alert"}>
        {feedback.message}
        {feedback.kind === "conflict" && <button type="button" className="button button-secondary retry-button" disabled={refreshing} onClick={() => void loadActions(true)}>{refreshing ? "Refreshing..." : "Refresh Actions"}</button>}
      </div>}

      {state === "loading" && <p className="loading-message" role="status">Loading Actions Taken...</p>}
      {state === "error" && <div className="alert alert-error" role="alert">{loadError ?? "Unable to load Actions Taken."}<button type="button" className="button button-secondary retry-button" onClick={() => void loadActions(false)}>Retry Actions</button></div>}

      {state === "ready" && items.length === 0 && <p className="empty-detail">No Actions Taken yet.</p>}
      {state === "ready" && items.length > 0 && <div className="actions-list" aria-label="Actions Taken history">
        {items.map((action) => {
          const terminal = isTerminal(action.status);
          return <article className="action-item" key={action.id}>
            <div className="action-item-heading">
              <div><span className={`queue-badge queue-badge-${action.status.toLowerCase().replaceAll("_", "-")}`}>{labelStatus(action.status)}</span><span className="action-created">{formatDate(action.createdAt)}</span></div>
              {operational && !terminal && !mode && <button type="button" className="button button-secondary" onClick={() => openEdit(action)}>Edit Action</button>}
            </div>
            <p className="action-description preserve-whitespace">{action.description}</p>
            <dl className="action-meta-grid">
              <div><dt>Performed by</dt><dd>{action.performedBy.name}</dd></div>
              <div><dt>Assignee</dt><dd>{action.assignee?.name ?? "Unassigned"}</dd></div>
              <div><dt>Result</dt><dd className="preserve-whitespace">{action.result ?? "Not recorded"}</dd></div>
              <div><dt>Follow-up</dt><dd>{action.followUpRequired ? "Follow-up required" : "No follow-up required"}</dd></div>
              {action.followUpNote && <div className="action-meta-wide"><dt>Follow-up note</dt><dd className="preserve-whitespace">{action.followUpNote}</dd></div>}
              {action.attachmentNotes && <div className="action-meta-wide"><dt>Attachment notes</dt><dd className="preserve-whitespace">{action.attachmentNotes}</dd></div>}
            </dl>
            {terminal && <p className="action-terminal-note">Terminal · read-only</p>}
          </article>;
        })}
      </div>}

      {operational && mode && <form className="action-form" onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate>
        <div className="action-form-heading"><h3>{mode.kind === "create" ? "Add Action" : "Edit Action"}</h3><p>{mode.kind === "create" ? "New Actions start as PENDING." : `Saving against Action version ${mode.expectedVersion}.`}</p></div>
        <label htmlFor={`action-description-${ticketId}`}>Description<textarea aria-label="Description" id={`action-description-${ticketId}`} value={draft.description} maxLength={2000} disabled={saving} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? `action-description-error-${ticketId}` : undefined} onChange={(event) => setDraftField("description", event.target.value)} />{fieldErrors.description && <small id={`action-description-error-${ticketId}`} className="field-error">{fieldErrors.description}</small>}</label>
        <div className="action-form-grid">
          <label htmlFor={`action-assignee-${ticketId}`}>Assignee<select aria-label="Assignee" id={`action-assignee-${ticketId}`} value={draft.assigneeId} disabled={saving} onChange={(event) => setDraftField("assigneeId", event.target.value)}><option value="">Unassigned</option>{currentAssigneeMissing && <option value={currentAssigneeMissing.id} disabled>{currentAssigneeMissing.name} (no longer eligible)</option>}{assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} - {owner.role.replaceAll("_", " ")}</option>)}</select>{fieldErrors.assigneeId && <small className="field-error">{fieldErrors.assigneeId}</small>}</label>
          {mode.kind === "edit" && <label htmlFor={`action-status-${ticketId}`}>Action status<select aria-label="Action status" id={`action-status-${ticketId}`} value={draft.status} disabled={saving} onChange={(event) => setDraftField("status", event.target.value as ActionTakenStatus)}>{statusChoices.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select>{fieldErrors.status && <small className="field-error">{fieldErrors.status}</small>}</label>}
        </div>
        <label htmlFor={`action-result-${ticketId}`}>Result<textarea aria-label="Result" id={`action-result-${ticketId}`} value={draft.result} maxLength={2000} disabled={saving} aria-invalid={Boolean(fieldErrors.result)} onChange={(event) => setDraftField("result", event.target.value)} />{fieldErrors.result && <small className="field-error">{fieldErrors.result}</small>}</label>
        <label className="action-checkbox" htmlFor={`action-followup-${ticketId}`}><input aria-label="Follow-up required" id={`action-followup-${ticketId}`} type="checkbox" checked={draft.followUpRequired} disabled={saving} onChange={(event) => { const checked = event.target.checked; setDraft((current) => ({ ...current, followUpRequired: checked, followUpNote: checked ? current.followUpNote : "" })); setFieldErrors((current) => ({ ...current, followUpRequired: "", followUpNote: "", status: "" })); }} />Follow-up required</label>
        {draft.followUpRequired && <label htmlFor={`action-followup-note-${ticketId}`}>Follow-up note<textarea aria-label="Follow-up note" id={`action-followup-note-${ticketId}`} value={draft.followUpNote} maxLength={1000} disabled={saving} aria-invalid={Boolean(fieldErrors.followUpNote)} onChange={(event) => setDraftField("followUpNote", event.target.value)} />{fieldErrors.followUpNote && <small className="field-error">{fieldErrors.followUpNote}</small>}</label>}
        <label htmlFor={`action-attachment-notes-${ticketId}`}>Attachment notes<textarea aria-label="Attachment notes" id={`action-attachment-notes-${ticketId}`} value={draft.attachmentNotes} maxLength={1000} disabled={saving} aria-invalid={Boolean(fieldErrors.attachmentNotes)} onChange={(event) => setDraftField("attachmentNotes", event.target.value)} />{fieldErrors.attachmentNotes && <small className="field-error">{fieldErrors.attachmentNotes}</small>}</label>
        <div className="form-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={closeForm}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : mode.kind === "create" ? "Save Action" : "Save Changes"}</button></div>
      </form>}
    </section>
  );
}
