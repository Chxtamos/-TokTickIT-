# Lab 4 UI Specification

Status: Issue #91 specification baseline. Lab 4 extends, rather than replaces, the existing Zen Green design system.

## Application shell and navigation

- Requester navigation adds **Dashboard** while preserving My Tickets/Create Ticket/profile/logout.
- IT Staff navigation adds **Dashboard** while preserving Queue/Ticket Detail/profile/logout.
- Administrator may use the Staff Dashboard and retains Admin User Management.
- Active destination is visibly indicated and unauthorized destinations are not presented; backend authorization remains authoritative.

## IT Staff Dashboard

Desktop: concise metric-card row followed by recent/urgent Tickets and My Recent Actions. Cards cover Unassigned Tickets, My Tickets and My Open Actions; compact breakdowns show Status and IT Priority. Actionable cards/items link to the corresponding filtered Queue or Ticket Detail. Tablet wraps cards; mobile uses one-column cards/lists. Loading uses existing conventions; empty lists explain that no matching work exists; forbidden/safe failure has a clear non-sensitive message and retry where meaningful.

## Requester Dashboard

Show Open Tickets and Waiting for Requester metrics plus Recently Updated and Recently Resolved owned Tickets. It is a summary, not a duplicate My Tickets grid. Items link to owned Ticket Detail and cards to My Tickets filters. Never accept/display another requester identity.

## Actions Taken on Ticket Detail

Use a distinct **Actions Taken** section/tab consistent with Public Comments/Internal Notes/Attachments. Default list is stable oldest-first. Each row/card shows created date/time, description, result, performer, assignee, status, follow-up state/note and attachment notes when present.

Operational users receive **Add Action** and permitted **Edit** controls. Create/edit form fields: description, result, assignee, follow-up required, conditional follow-up note, attachment notes and (edit only) permitted status transition. Performer and creation time are read-only/backend-derived. Requesters see the same safe history read-only with no create/edit/assign/status controls.

Completed/Cancelled Actions are visibly terminal and read-only. Ineligible assignee, stale conflict and validation failures keep recoverable form input. Submit is disabled while saving, but UI busy state is not relied on for idempotency.

## Ticket workflow feedback

Only contracted next statuses are offered. Resolution UI explains that at least one Action must exist and all Actions must be terminal; backend rejection is rendered beside the workflow control without losing unrelated Ticket state. Successful status changes refresh summary/status/action state.

## Feedback modes

Major screens support meaningful loading, saving, validation, success, empty/no-results, forbidden, not-found, conflict and safe API-failure states. Do not expose stack traces, database details, hidden IDs or private Internal Note data. Recoverable form errors retain user input.

## Responsive and accessibility

- Required evidence viewports: desktop 1440px, tablet 768px, mobile 390px and 360px; retain 200%-zoom-equivalent checks used by Lab 3.
- No document-level horizontal scrolling, clipped content, overlapping controls or inaccessible dialogs.
- Interactive elements are keyboard reachable with visible focus; dialogs/forms have logical focus behavior.
- Inputs have semantic labels and validation associations; headings/regions remain meaningful.
- Status/priority/action state never relies on color alone; text labels remain visible.
- Metric cards use accessible links/buttons rather than clickable non-semantic containers.
- Reuse existing Zen Green spacing, typography, cards, badges, buttons, forms, tables and error conventions.

## Visual evidence checklist

Final human review must inspect Staff Dashboard, Requester Dashboard and Actions Taken at required viewports for design consistency, readable hierarchy, role-appropriate controls, editable/read-only distinction, validation placement, keyboard focus, clipping, overlap and horizontal overflow. Automated screenshot/no-overflow evidence may support but must not be mislabeled as human sign-off.
