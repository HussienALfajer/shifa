# A-01-08 UI batch 3: team, branches and switcher screens

Status: In progress (checkpoint 1 approved 2026-11-24; waiting for A-01-12) · Tier: T1 · Branch: `feat/A-01-08-ui-team-branches-switcher`
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) screen inventory, verification rows for criteria 9–11 (Playwright) and "Screens" · Requirements: PLT-03, PLT-04, PLT-05, PLT-06, PLT-43, PLT-45 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-79, OD-80, OD-94, OD-102 to OD-106

After [A-01-07](A-01-07-ui-sign-in-screens.md) (merged); may run beside [A-01-10](A-01-10-ui-account-settings-admin-web.md). The clinic chooser moved to A-01-07 in the 2026-11-24 re-plan. Last A-01 slice with A-01-10; A-01a and A-01b are done when it merges and the owner accepts.

## Goal
The owner manages the team and branches from clinic-web; a person in several clinics switches clinic and branch from the header; invitations are accepted or declined on their link.

## Added by A-01-07 checkpoint 1 (owner, 2026-11-24)
- The member detail gains «إعادة ضبط التحقق بخطوتين» for the owner (OD-95; route built in A-01-09): confirmed with an AlertDialog, ends the member's sessions, audited; a shared account answers `account_shared` (super admin). Drawn with this batch's screens.
- Use the approved Callout for page messages (A-01-07 sheet).

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept; "Shifa Screens · Clinic web", page "A-01 Foundation" (drafts of 2026-11-23 reviewed and updated).
- Screens: Header switcher (menu on desktop and tablet, bottom sheet on phone), Accept invitation (phone, desktop), Team (desktop, tablet), Member drawer (desktop; bottom sheet on tablet), Branches (desktop).
- Working prototype in Play: flows clinic → switch branch → switch clinic; owner adds a receptionist for one branch → link shown once → shares; owner turns off «رؤية الملاحظات السريرية» for an assistant; deactivates a member (confirm); archives a branch (confirm naming the members whose sessions end); accepts and declines an invitation. Every state reachable: suspended clinic in the switcher, invalid link, last owner (disabled with the reason), phone already in the team, last active branch, empty and loading, solo clinic (no branch screens, no branch switcher), one clinic with one branch (switcher hidden). Light and dark, the sizes switchable, Arabic RTL, synthetic data from `@shifa/testing` only.
- Checked before showing (literal colours, unknown `--shifa-` names, look-alike components); result written here.
- Analysis written here (ADR-0046): the route, field and error table for the team, branch, switcher and invitation routes (A-01-04, A-01-05 contracts) against every state, API gaps and anything unprofessional in the API, spec gaps, creative improvements with costs.
- Missing components drawn in this checkpoint on their own sheet with every state and at once on their screens (likely: a scope chip "role · branch", a member row with status, a switcher menu with two groups); approved or changed by the owner, then built with `/ui-component` and synced before checkpoint 2.

### Checkpoint 2 — header switcher, invitation
Switching calls `POST /me/switch` and reloads the page data (Query cache cleared per scope); phone layout uses the bottom sheet.

### Checkpoint 3 — team and member drawer
Team table (`@shifa/ui` Data Table; search; statuses in words), member drawer (role assignments with scope, sensitive toggles with the role default named, link shown once with copy and WhatsApp share, re-issue, deactivate and reactivate confirmed), last-owner and duplicate-phone states from the API codes.

### Checkpoint 4 — branches
Cards, add and edit, archive with the preview of affected members, archived list, last active branch disabled with the reason; hidden for a solo clinic.

### Checkpoint 5 — journeys, screenshots, review
Playwright against the real backend: switch clinic and branch from the header; owner adds a member → member opens the link → signed in with the branch role; a doctor accepts a second clinic's invitation; deactivation signs the member out on their next request. Screenshots against the real backend, light and dark, listed sizes, compared with the approved drawings; axe clean; `reviewer` agent.

Tests written first: component tests per screen state; the four Playwright journeys; screenshot comparisons.
Estimated hand-written lines: ~3,100 (switcher ~400, invitation ~300, team and drawer ~1,300, branches ~500, journeys ~600); missing components are separate `/ui-component` work.

## Drawings and analysis
Drawn 2026-11-24 (links not committed, ADR-0040). On "Shifa Screens · Clinic web", new page "A-01-08 Team batch": one interactive prototype (`Team08`, marked interactive, Play), the analysis board (`Analysis08`, Arabic, for the owner) and the sheet of the one missing component (`MenuGroupsSheet`). The 2026-11-23 drafts `Switcher`, `Team`, `Member` and `Branches` on page "A-01 Foundation" were reviewed and are superseded by `Team08` (a note on the page says so). The installed Shifa Design System copy is unchanged (the same version as A-01-10 used). Colours, spaces, radii, shadows and sizes are `--shifa-*` tokens and type uses the named styles; before showing, every `--shifa-` name was checked against the installed `tokens.css` and `bundle.css` (five names that do not exist were replaced) and no literal colour is left. Callout, CopyField and QrCode are not yet in the synced bundle, so they are drawn by hand from their approved sheets; the team table is drawn by hand at DataTable's sizes (in code: DataTable with a link cell); the member drawer is drawn from Drawer's tokens (the bundle's Drawer takes text fields only). **Approved by the owner on 2026-11-24 («موافق على كل شئ»): all screens of the prototype, the Menu groups addition, every improvement (a–i) and every proposal of the gap list; API gaps 1, 5, 6 and 8 accepted as proposed (OD-102 to OD-105); spec question 4 kept as built (OD-106).** API gaps 1–8 are closed in the T0 slice [A-01-12](A-01-12-team-branch-api-gaps.md) before checkpoint 2.

### The prototype (`Team08`)
A control panel outside the device frame switches theme (light, dark), size (desktop 1280 × 800, tablet 768 × 1024, phone 390 × 844), the person (an owner in three clinics: owner of a three-branch clinic, doctor in two branches of a second, staff of a suspended third, with a pending invitation; a doctor in two clinics, one branch in one and every branch in the other; a solo clinic's owner; a receptionist with one clinic and one branch), a "go to" list (home and switcher, team, branches, clinic settings, invitation page), the data (full, empty team, loading), the invitation page's case (signed out, signed in as the invitee, signed in as someone else, invalid link), the server's answer to the next press (per context, every error code of the table below; it falls back to success after each press), a checkbox per improvement and per API-gap proposal.

Flows that run end to end: header switcher → another clinic (one branch held: switched at once; two or more branches held: the branch step inside the menu) → page data reloads, «أنت الآن في …»; switch branch; suspended clinic disabled with the reason; every switch error as a Callout inside the menu; phone: the same list in a bottom sheet; one clinic with one branch: no switcher, the clinic named as text. Owner adds a receptionist for one branch → name, phone and role refused before sending, `body.phone`, `phone_in_team`, `branch_archived`, no connection (input kept) → link shown once (copy, WhatsApp, expiry, QR) → closing before a copy or share asks first. Owner turns off «رؤية الملاحظات السريرية» for an assistant (the role default named; «إعادة إلى ما يعطيه دوره»); edits roles with scope; removing every role confirmed; `last_owner` and `owner_role_protected`; the last owner's own role and deactivation disabled with the reason. Deactivate (confirmed; «إلغاء الدعوة» for a pending member), reactivate (back to active or pending), new link (pending) or password link (active; `account_shared`), TOTP reset (confirmed; not for an owner; `mfa_not_enrolled`, `account_shared`). Branches: add, edit (`body.phone`, `branch_archived`), archive with the preview naming the members whose sessions end, archived list; archiving down to one branch shows the last-branch state and the page then leaves the menu; a solo clinic's owner adds the second branch from clinic settings (improvement f). Invitation: signed out → «الدخول للرد على الدعوة» → accept (→ «فتح العيادة») or decline (confirmed); invalid link without the clinic's name; signed in as someone else (404 today; gap 6 drawn as a proposal).

### Route, field and error table (ADR-0046)
| Route | Fields: shown, driving a state, or not shown (why) | Errors and states drawn |
|---|---|---|
| `GET /me/clinics` | `name` and avatar; `roles` in words with `tenantWide` («كل الفروع») or the branch count; `lastActiveAt` in the second line; `status`/`selectable` (suspended: disabled, badge and reason); `solo` hides the branch group; `branches` the branch group («كل الفروع» first for a tenant-wide role); `invitations` for information (improvement g). Not shown: `tenantId`, the invitation `id` | one clinic and one branch: no switcher; 404 `no_clinic`: A-01-07 page |
| `POST /me/switch` | `tenantId`, `branchId`; roles in two or more branches without a tenant-wide one: the branch step before sending; `ActiveClinic` clears the query cache and reloads the page | 400 `branch_required` not reachable (branch step); 403 `clinic_suspended`, `branch_not_held`; 404; 409 `branch_archived`: Callout in the menu; no connection: stays in the current clinic |
| `GET /team/members` | `name` (opens the drawer), `phone` LTR, `roles` as «role · branch» badges, `status` badge in words, `lastActiveAt`. Not shown: `id` | loading; empty (the owner alone); no match; filter by status (a) and branch (e) |
| `GET /team/members/:id` | `permissions[]`: `granted` the switch, `roleDefault` «مفتوحة/مغلقة افتراضياً لـ…», `overridden` «فتحتَها/أغلقتَها لهذا الشخص» and the reset (`granted: null`); `isLastOwner` locks the owner role and deactivation with the reason; `mfaEnrolled` badge and the reset for non-owners | 404 |
| `POST /team/members` | name, phone, roles; `member` opens its drawer; `link.url`, `whatsappUrl`, `expiresAt` once (CopyField); no link purpose by design (OD-76) | name, phone and one role checked before sending; 400 `body.phone`; 409 `phone_in_team` under the phone; 409 `branch_archived` Callout; no connection, input kept |
| `PATCH /team/members/:id` | the full role list and the changed keys | 409 `last_owner`, `owner_role_protected`, `branch_archived`; 400 `permission_not_sensitive` not reachable; 404; no connection; every role removed: confirmed |
| `POST …/deactivate`, `…/reactivate` | pending: «إلغاء الدعوة»; else «إيقاف الحساب»; deactivated: «إعادة التفعيل» back to active or pending | 409 `last_owner`; bare 409 (gap 2); no connection inside the confirmation |
| `POST …/setup-link` | pending: «إصدار رابط جديد» (the earlier stops); active: «رابط لكلمة مرور جديدة» (clears it, ends sessions); the link once | 409 `account_shared` Callout; bare 409 for a deactivated member (button hidden); no connection |
| `POST …/reset-mfa` | enrolled non-owners, confirmed; the badge turns «غير مفعّل» | 409 `owner_mfa_platform` not reachable («تعيده إدارة شفاء»); `mfa_not_enrolled` refreshes; `account_shared` Callout; no connection |
| `POST /invitations/view` | `clinicName`, `personName`, `roles` with branch, `expiresAt` | 404 `link_invalid`: «هذا الرابط لم يعد صالحاً» without the clinic's name |
| `POST /invitations/accept`, `decline` | signed out: sign in and come back; signed in: accept, decline confirmed; accepted: «فتح العيادة» switches there | 404 `link_invalid` (also when signed in as someone else, gap 6); no connection |
| `GET /branches` | `active` cards: `name`, `address`, `phone` LTR, `memberCount` (tenant-wide roles not counted, said so); `archived` list with `archivedAt`. Not shown: `id` | loading; one active branch: branches leave the menu and the switcher |
| `POST`, `PATCH /branches` | name required, address and phone optional | empty name before sending; 400 `body.phone`; 409 `branch_archived`; no connection |
| `GET …/archive-preview`, `POST …/archive` | `members` named in the confirmation; `lastBranch` disables archiving with the reason | 409 `last_branch` in the confirmation; 409 `branch_archived` moves it to archived; no connection |

### API gaps (to close in the API before or in this slice, never worked around in the client)
1. **Sensitive toggles when adding:** no catalogue route and no `permissions` in `AddMemberRequest`, so the owner neither sees the role default nor changes it before the link is sent. Proposal: `GET /team/permissions` (sensitive keys with each role's default) and `permissions` on add. Or keep it as drawn (changed after saving). **Accepted (OD-102).**
2. **Bare 409s:** deactivating a deactivated member, reactivating one who is not, a link for a deactivated member. Proposal: `member_deactivated`, `member_not_deactivated`.
3. **Undeclared statuses:** 400 on `teamAddMember`, `teamUpdateMember`, `branchesCreate`, `branchesUpdate`; `branch_archived` not named on `teamAddMember`.
4. **Pending member's link expiry not returned:** proposal `linkExpiresAt` on `MemberSummary`, so a row says «انتهى الرابط» (improvement b), as `owner.linkExpiresAt` in A-01-11.
5. **Name or phone cannot be corrected:** a typo leaves an invitation to a wrong number. Proposal: edit the name of any member and the phone while pending (as OD-99). **Accepted (OD-103).**
6. **Invitation while signed in as someone else:** accept answers 404 `link_invalid`, as for a used link, so the person cannot tell their number is the problem. Proposal: `phoneMasked` in `InvitationView` (as the setup link) and `invitation_other_phone` for a signed-in other person. **Accepted (OD-104).**
7. **"You" in the team:** `MemberSummary` does not say which row is the owner themselves, so «رابط لكلمة مرور جديدة» and the TOTP reset would show on oneself. Proposal: `isSelf`, and the server refusing deactivate, new link and TOTP reset on oneself (`self_action`).
8. **No branch restore:** an archived branch cannot come back. Proposal: `POST /branches/:id/restore`, or archiving stays final. **Accepted: restore (OD-105).**
9. **Not gaps for Release 1:** no paging on the team (small teams; searched in the client); `memberCount` excludes tenant-wide roles (the card says so).

### Spec gaps (to add to A-01b)
1. A solo clinic has no branch screens, so its owner has nowhere to add the second branch. Proposal: a «الفروع» card in clinic settings (improvement f).
2. "Last active branch, archive disabled" is reachable only after archiving down to one branch while on the page; the page then leaves the menu.
3. Team on a phone (the spec lists desktop and tablet): a list of cards, the drawer as a bottom sheet. Branches on tablet and phone: two columns, then one.
4. The owner role does not grant `clinical.notes.view`: an owner who is not a doctor sees no clinical notes unless the switch is turned on for them. Kept as built (OD-106).
5. Removing every role is allowed by the API: drawn with a confirmation that the person leaves this clinic.
6. Pending invitations in the header switcher are information only, answered on their link (OD-91).
7. A doctor with one branch in a clinic: no branch group; the button reads «clinic · branch».

### Creative improvements (each toggled in the prototype; the owner accepts or declines each)
| | Improvement | Cost |
|---|---|---|
| a (أ) | Team filtered by status, with counts | ~40 lines |
| b (ب) | «انتهى الرابط» on a pending member, with a new link (needs gap 4) | ~25 lines |
| c (ج) | «أنت الآن في …» after switching | ~15 lines |
| d (د) | «حفظ» in the member drawer disabled until something changes | ~10 lines |
| e (هـ) | «عرض فريقه» on a branch card filters the team | ~30 lines |
| f (و) | A solo clinic adds its second branch from clinic settings (spec gap 1) | ~60 lines |
| g (ز) | Pending invitations listed in the switcher, for information | ~25 lines |
| h (ح) | Ask before closing the link without a copy or share | ~15 lines, reuses admin web |
| i (ط) | QR code of the link for a member who is present | ~15 lines with QrCode |

Accepted by the owner 2026-11-24: all nine. Declined: none.

### Components
- **Menu groups (an addition to Menu, not a new component; sheet `MenuGroupsSheet`):** `MenuGroup` with a label, `MenuRadioItem` with an avatar or icon, a second line, a badge, the check at the logical end and a busy state, and an in-place branch step; states default, hover, keyboard focus, checked, disabled with the reason (suspended clinic), busy, one group only, dark, compact, LTR English; on a phone the same rows in a bottom Drawer. Built with `/ui-component` and synced before checkpoint 2.
- **No new chip:** Badge `outline` carries «role · branch»; Badge's locked tones carry the status in words.
- **Missing icons:** branches (Solar `buildings`) and archive (Solar `archive`), added in `packages/ui` and synced; drawn meanwhile with `list` and `x-circle`.
- CopyField, QrCode and Callout await the design-system sync (the owner starts it).

### Not done in this checkpoint
Tests and code: the plan's tests are written after the approval (no code before it, OD-80).

## Stopped at
Checkpoint 1 approved by the owner (2026-11-24). Next: the API gaps in [A-01-12](A-01-12-team-branch-api-gaps.md) (T0), then the Menu groups addition with `/ui-component` and the `buildings` and `archive` icons, synced, then checkpoint 2 with its tests first.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
