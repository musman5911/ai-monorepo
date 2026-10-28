# Session 2 security problems register

**Purpose:** Track the owner's A–O problem report and ROLE-F1 without expanding Phase 14 into unrelated repairs.

**Source limitation:** The original A–O report and ROLE-F1 description were not present in the current branch or available project files when this register was created. The statuses below preserve the specific identifiers and findings supplied in the task context; descriptions not available from that context are deliberately not guessed. Attach the original report before treating the unlisted identifiers as reviewed.

| Item | Status | Evidence / disposition |
|---|---|---|
| A1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| A2 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| A3 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| A4 | False | Verified in the supplied audit context: Agri and Flock cookies use `httpOnly` and `sameSite: 'lax'`; Dairy sets no authentication cookie. |
| A5 and any other A items | Not checked | The source report is unavailable; item definitions cannot be reconstructed safely. |
| B1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| B2 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| B3 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| C1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| C2 | False | Verified in the supplied audit context: CORS reflects origins only outside production; all three `.replit` configurations set production. |
| C3 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| D–F items | Not checked | The original report and item definitions are unavailable. |
| G1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| G2 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| G3 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| H1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| I–M items | Not checked | The original report and item definitions are unavailable. |
| N1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |
| O items | Not checked | The original report and item definitions are unavailable. |
| ROLE-F1 | True | The owner-provided task context says this issue remains present in code. Exact description unavailable; record for Session 2. |

## Scope and handling

- Only a confirmed cross-farm data disclosure or unauthenticated write is in scope for an immediate Phase 14 fix.
- Other findings remain recorded for Session 2 and must not be silently fixed during this phase.
- Do not treat `True` entries as independently re-audited in this pass; those statuses preserve the owner's explicit report in the task context.
- Replace this provisional register with the complete, item-by-item mapping when the original A–O report and ROLE-F1 description are available.
