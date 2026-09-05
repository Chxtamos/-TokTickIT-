# Lab 2 Zen Green UI Specification

## 1. Design Principles

- Professional, calm, readable, and consistent with TokTickIT's Zen Green direction.
- Current Requester identity and available actions are always clear.
- Editable and read-only values remain distinguishable without relying only on color.
- Validation stays close to the affected field and recovery actions are explicit.
- Desktop/mobile representations may differ but provide equivalent information/actions.
- Reusable components are preferred over screen-specific styling.

## 2. Design Tokens

### Colors

| Token | Value | Use |
| --- | --- | --- |
| `--color-green-primary` | `#006B3C` | Header, primary buttons, strong emphasis |
| `--color-green-secondary` | `#0B7A46` | Active navigation, focus, links, hover |
| `--color-green-pale` | `#EAF6EF` | Selected/success/subtle emphasis |
| `--color-page` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, editable controls |
| `--color-text` | `#173B2C` | Primary charcoal-green text |
| `--color-text-muted` | `#52685E` | Secondary text |
| `--color-border` | `#C9D6CF` | Neutral boundaries |
| `--color-readonly` | `#EFF3F0` | Read-only fields |
| `--color-error` | `#9B1C1C` | Error text/border |
| `--color-warning` | `#9A6700` | Warning only |
| `--color-warning-bg` | `#FFF4CE` | Warning background |
| `--color-focus` | `#0B7A46` | Keyboard focus ring |

Success, warning, priority, status, error, active, and removed states always include text or accessible names; color alone is insufficient.

### Typography and Spacing

- Font stack: `Inter`, `Segoe UI`, `Roboto`, system sans-serif.
- Body: 16 px, line-height 1.5; small/meta text minimum 14 px.
- Page title: 28-32 px, weight 700; section title: 20-24 px, weight 650-700.
- Form labels: 14-16 px, weight 600; placeholders never replace labels.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.
- Default control height and touch target: at least 44 px where practical.
- Card radius: 8-12 px; button/control radius: 6-8 px.
- Surfaces use white, subtle border, and restrained shadow.

## 3. Application Shell and Navigation

### Desktop and Tablet

- Primary Green header with TokTickIT identity.
- Navigation contains My Tickets and Create Ticket.
- Active page is visually clear and uses `aria-current="page"`.
- Current Development Requester name and Change Requester action remain visible.
- Header content aligns with the page maximum width.

### Mobile

- TokTickIT identity remains visible.
- Navigation collapses into an accessible menu or compact stacked layout.
- Controls have text/accessible names and visible focus.
- Current Requester and Change Requester remain reachable without horizontal scrolling.

### Route Guard

- No valid Requester: render the selector without flashing requester-owned content.
- While restoring/validating selection: show a labelled page-level loading state.

## 4. Development Requester Selection

Required content:

- TokTickIT title.
- `Select a Development Requester` heading.
- Explanation that this is Lab 2 testing only, not login/authentication.
- Labelled dropdown populated from PostgreSQL.
- Continue button disabled until a Requester is selected.

States:

- **Loading:** disabled controls, `Loading Requesters…`, `aria-busy`.
- **Ready:** active Requesters in deterministic order.
- **Empty:** no-active-Requester explanation and Retry.
- **Failure:** safe inline alert and Retry.
- **Validating:** Continue uses busy text and blocks duplicate activation.

Use a centered surface with maximum width around 560 px and natural mobile stacking.

## 5. Shared Form Components

### Labels and Required Markers

- Labels appear above controls with consistent spacing.
- Required fields show a red asterisk and semantic required state.
- A nearby legend explains `*`; the asterisk never replaces validation text.

### Editable, Read-only, Invalid, and Disabled Controls

- Editable: white background, neutral border, dark text.
- Read-only: soft gray-green background, readable text, and hint such as `Generated after submission` when needed.
- Focus: visible 2-3 px green ring with sufficient contrast.
- Invalid: dark red border/text; message immediately below and linked using `aria-describedby`.
- Disabled: visibly muted, semantically disabled, and non-activatable.
- Invalid submit moves focus to the first invalid field.

### Buttons

- Primary: solid Primary Green; one dominant action per section.
- Secondary: white/pale surface with green border/text.
- Tertiary: text/link style for low-emphasis actions.
- Destructive: dark red styling only for confirmed removal.
- Busy: retains size, shows `Submitting…`, `Uploading…`, or `Removing…`, exposes busy semantics, and disables repeat activation.
- Icon-only controls require an accessible label and tooltip.

## 6. Create Ticket Screen

Information order:

1. Heading and instruction.
2. Read-only Ticket Number, Ticket Date, and Requester.
3. Category, Related System, and Requested Priority.
4. Summary and Description.
5. Attachment selection and per-file results.
6. Safe form/partial-failure feedback.
7. Secondary Cancel/Back and primary Submit Ticket actions.

Field behavior:

- Ticket Number: `Generated after submission` before success.
- Ticket Date: `Recorded after submission` before success.
- Requester: current selected Requester; never editable on this form.
- Requested Priority: default Medium, still editable.
- Summary receives sufficient/full width when constrained.
- Description is multi-line; vertical resize only if layout remains intact.
- Accessible character counts appear near approved limits.

Attachment selection:

- Hint: `JPG, JPEG, PNG, WEBP, or PDF; maximum 5 MiB each; maximum 5 active files`.
- Each selected file shows filename, formatted size, state, and Remove-from-selection.
- Invalid files remain visible with their reason and are never submitted.
- Exceeding five shows an actionable error.
- Long filenames wrap/truncate visually without page overflow; full name remains accessible.

Screen states:

- **Initial/loading:** dependent controls disabled until reference data is ready.
- **Validation failure:** field messages, first invalid focus, values retained.
- **Submitting:** mutating controls disabled and button reads `Submitting…`.
- **Success:** confirmation with official backend Ticket Number and `View Ticket`/`Go to My Tickets`.
- **API failure:** safe alert, values/files retained, Retry available.
- **Partial Attachment failure:** Ticket-success confirmation plus per-file results and Ticket Detail/retry action.

## 7. My Tickets

### Toolbar

- Title, selected Requester context, and primary Create Ticket action.
- Labelled search input.
- Category, Related System, Requested Priority, and Current Status filters.
- Sort field/direction.
- Clear Filters available only when non-default criteria exist.
- Search/filter change resets to page 1.

### Desktop Table

Columns:

- Ticket Number
- Summary
- Category
- Related System
- Requested Priority
- Current Status
- Last Updated
- Explicit View action

Use semantic headers and expose sort direction through text/ARIA.

### Mobile Cards

Each card includes Ticket Number, Summary, Category, Related System, Requested Priority, Current Status, Last Updated, and a touch-friendly View Ticket action.

### Pagination

- Show current page, total pages, and total item count.
- Previous/Next and page controls have accessible names and disabled boundary states.
- Page sizes: 10, 20, 50; changing size resets to page 1.
- No horizontal overflow.

### Result States

- Loading: labelled state; old Requester data is not shown as new data.
- Empty: `You have not created any tickets yet` plus Create Ticket.
- No results: `No tickets match the current search or filters` plus Clear Filters.
- Failure: safe alert, Retry, and preserved controls.
- Invalid query: recoverable message and Reset to defaults.

## 8. Requester Ticket Detail

- Back to My Tickets while preserving appropriate list state within the same Requester context.
- Ticket Number as the primary identifier.
- Ticket Date, Requester, Category, Related System, Summary, Requested Priority, Description, and Current Status are read-only.
- Use labelled cards/definition lists where practical rather than editable-looking controls.
- Do not render Public Comments, Internal Notes, Actions Taken, Event Log, IT Staff controls, status controls, or resolution workflow.

Badge rules:

- Every badge contains text.
- Requested Priority: Low, Medium, High, Urgent.
- Current Status in Lab 2: New.
- IT Priority may have a future component variant, but no editable Lab 2 workflow.

## 9. Attachment Section

### Active

- Filename, type, size, uploaded timestamp.
- Download and owner Remove actions.
- Optional safe browser preview may be considered only after Human approval; download remains required.

### Uploading/Invalid/Unavailable

- Per-file busy/result state and duplicate prevention.
- Success replaces pending data with authoritative API metadata.
- Failure retains filename and shows Retry/Remove-from-queue.
- Storage failure displays `File temporarily unavailable` without server paths.

### Removed

- Metadata remains with textual `Removed` badge, removed time, and reason.
- No Download, Preview, or Remove-again action.

### Removal Confirmation

- Accessible dialog names the file and explains the result.
- Reason required, 5-250 characters.
- Focus enters/traps in dialog and returns to trigger on close.
- Confirm uses destructive busy state `Removing…`.

## 10. Feedback Components

- Inline field errors are associated with one control.
- Page alerts provide safe failure and Retry when meaningful.
- Success remains long enough to read and includes next action.
- Warning callouts are reserved for partial upload failure or unsaved-change confirmation.
- Empty/no-results states include explanation and useful action.
- Live regions announce important asynchronous updates without repeated noise.

## 11. Responsive Layout

| Viewport | Required behavior |
| --- | --- |
| Desktop `>= 992px` | Centered max-width around 1200 px; multi-column form; full Ticket table |
| Tablet `768-991px` | Two columns where practical; Summary, Description, Attachments full width when needed |
| Mobile `< 768px` | Stacked fields/actions; My Tickets cards; touch-friendly controls; no page-level horizontal scroll |

At all sizes:

- No clipped labels/messages, overlap, hidden actions, or unreadable filenames.
- Dialog actions remain reachable.
- Browser zoom to 200% preserves required content/function.

## 12. Accessibility

- Logical semantic headings and one primary page heading.
- Programmatic labels, descriptions, required state, and invalid state.
- Complete keyboard operation and visible focus.
- Active navigation uses semantics in addition to color.
- Table headers/sort state are exposed.
- Loading/busy/result updates are announced appropriately.
- Accessible dialog focus management.
- WCAG 2.1 AA contrast for normal text and meaningful controls.
- Reduced-motion preference respected.
- No state relies only on color.

## 13. Screenshot Paths

```text
artifacts/lab-02/screenshots/
├── requester-selection/
├── create-ticket/
├── my-tickets/
└── ticket-detail/
```

Evidence must include:

- Selector ready, loading, and failure.
- Create initial, validation, submitting, success, API failure, and invalid Attachment.
- My Tickets A/B, search/filter/sort/page, empty, no-results, and failure.
- Detail owned view, upload/download, removal dialog, removed metadata, blocked download, and unauthorized result.
- Desktop, tablet, and mobile captures for Create Ticket, My Tickets, and Ticket Detail.

## 14. Visual Inspection Checklist

- [ ] Color tokens match approved Zen Green rules.
- [ ] Editable/read-only fields are distinct.
- [ ] Required markers and validation messages are consistent.
- [ ] Button hierarchy and busy/destructive/disabled states are clear.
- [ ] Active page and current Requester are understandable.
- [ ] Priority/status badges include readable text.
- [ ] Empty and no-results states differ.
- [ ] Desktop table and mobile cards contain equivalent essential information.
- [ ] Attachment states are understandable.
- [ ] No clipping, overlap, hidden control, unreadable filename, or page overflow.
- [ ] Keyboard focus is visible and logical.
- [ ] Human compared screenshots with this approved specification.

## 15. Human Approval Items

**Approval status (2026-08-24): Approved by the student.**
