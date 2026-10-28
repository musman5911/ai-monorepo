# Session 2 problems (deferred until all 21 phases are finished)

Source: the owner's A to O problem report and the ROLE-F1 finding, with a status for each item.
Status key: **TRUE** (confirmed in the code), **FALSE** (the report is wrong), **FIXED?** (looks fixed in the code, not run), **NOT CHECKED**.
"Confirmed" means someone read the code on the `muf-monorepo` branch around 2026-10-28. Nothing here was tested in a browser or on a real MongoDB. Nothing here is fixed in Phase 14 unless it is a cross-farm data leak or an unauthenticated write.

## A. Session and auth
| ID | Problem | Status | Note |
|---|---|---|---|
| A1 | Logout does not revoke the token (all 3 backends); Dairy has no logout route | TRUE | Dairy has no logout route. Agri and Flock logout only clear the cookie; no denylist exists |
| A2 | Changing a password does not revoke old tokens | TRUE | No `tokenVersion` anywhere in the three backends |
| A3 | Token lifetime too long | TRUE for Dairy and Flock | Both default to 7 days. Agri not re-checked |
| A4 | Session cookie missing HttpOnly/SameSite | FALSE | Agri and Flock cookies are httpOnly, sameSite lax, secure on HTTPS. Dairy sets no cookie |
| A5 | Lost update: last write wins silently (Dairy, Agri PUT) | NOT CHECKED | |
| A6 | Agri mass assignment on create | TRUE for liabilities and inventory | Raw `req.body` is inserted. Other Agri create routes not checked |

## B. Public data exposure
| ID | Problem | Status | Note |
|---|---|---|---|
| B1 | Dairy public buyer card shows phone numbers | TRUE | Public bearer link by design; recorded as an accepted share-card risk in the route inventory |
| B2 | Dairy and Agri farm location is public | TRUE | Dairy `GET /location` and Agri location are open for the weather widget. Flock not checked |
| B3 | Agri public worker card shows wages and advances | TRUE | Same accepted share-card risk |
| B4 | Flock image readable across farms | FIXED? | The lookup is scoped by farm (commit f1cf04d). Not run |
| B5 | Agri worker responses too broad | NOT CHECKED | |

## C. Headers, CORS, cache, XSS
| ID | Problem | Status | Note |
|---|---|---|---|
| C1 | CSP missing | TRUE for Dairy and Agri | `contentSecurityPolicy: false`. Flock has a CSP |
| C2 | CORS reflects any origin with credentials | MOSTLY FALSE | Only when `NODE_ENV` is not production. The `.replit` files set production, where other origins are refused |
| C3 | Authenticated responses cacheable | TRUE | No `no-store` on authenticated JSON (public cards got privacy headers in Phase 14) |
| C4 | SVG upload served as active content (Flock) | NOT CHECKED | |
| C5 | `<script>` stored verbatim in text fields | NOT CHECKED | |

## D, E, F. Input validation
| ID | Problem | Status | Note |
|---|---|---|---|
| D1, D2, D3 | Dairy: huge numbers, oversized strings, ghost cow ids | NOT CHECKED | Dairy uses shared input readers, so some of this may already be handled |
| E1 to E5, E7, E9 to E12 | Agri validation gaps (crops, tasks, finance, suppliers, laborers, crop logs, automations, diary media) | NOT CHECKED | |
| E6 | Inventory: no validation, raw update | TRUE | `$set: req.body` |
| E8 | Liabilities: empty or negative accepted | TRUE | Raw insert |
| F1 to F4 | Flock validation gaps (batches, PATCH, vaccination logs, data buckets) | NOT CHECKED | |

## G. Agri business rules
| ID | Problem | Status |
|---|---|---|
| G1 | Negative liability stored | TRUE |
| G2 | Negative inventory through PUT | TRUE |
| G3 | Field acres has no upper bound (1e12 accepted) | TRUE (only "finite and not negative" is checked) |

## H to O
| ID | Problem | Status | Note |
|---|---|---|---|
| H1 | A calving event with generated calves can never be deleted after the calves are deleted | NOT REPRODUCED | The guard exists in `breeding-events.js`; not run |
| I1 | Backups have no integrity protection | NOT CHECKED | |
| I2 | A backup from another app partly "succeeds" | NOT CHECKED | |
| I3 | Flock junk restore and fresh-instance round trip | NOT CHECKED | |
| J1 | Flock import-all into a second farm fails with 500 | NOT CHECKED | |
| K1 | Telegram bot expense amount unbounded | NOT CHECKED | |
| L1 | Flock log redaction gap | NOT CHECKED | |
| M1 to M4 | Accessibility: color contrast, label mismatch, an unnamed select in Agri | NOT CHECKED | Needs a browser: Phase 20 |
| N1 | Dairy `DELETE /health/:id` returns 500 in memory mode | NOT CHECKED | |
| O1 | Rate limiter blocks load and matrix testing | TRUE (observed) | The route-matrix draft got 255 HTTP 429 responses |
| O2 | Red test `agri-fields-screens` | FIXED | Closed in the report |

## ROLE-F1
| ID | Problem | Status |
|---|---|---|
| ROLE-F1 | Flock `POST /auth/users` ignores the requested `farmIds` and assigns the creator's current farm | TRUE |

## Found while verifying (not in the original report)
| ID | Problem | Status | Note |
|---|---|---|---|
| X1 | A breeding event cannot be edited after its cow is sold: the server answers 400 "requires an active female animal", even for a notes-only edit | TRUE (reproduced in memory mode on 2026-10-26; not re-checked) | The cow should be re-validated only when the cow or bull changes |

## Re-test rule
Phases 19 to 21 test the code before these fixes. After the second session, repeat the parts of Phases 19 to 21 that touch validation, tokens, headers, CORS and uploads.
