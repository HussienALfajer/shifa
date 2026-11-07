---
paths:
  - "apps/**"
  - "packages/**"
---

# Patient data in code

- Never put names, phone numbers, national IDs, birth dates, addresses, diagnoses, notes or images in logs, error messages, metrics labels, analytics events, URLs or query strings. Log record IDs instead.
- Fixtures, seeds, snapshots and screenshots use the synthetic generator in `packages/testing` only.
- Every read of a patient chart goes through the audited read path; do not add a shortcut query.
- Signed clinical notes are immutable; corrections are addenda. Payments and completed procedures are voided with a reason, never deleted.
