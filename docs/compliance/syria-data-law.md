# Syrian data-protection and health-platform regulation

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: [RN-16 §2, §14], [RN-03 §1–§2], [RN-11 §1], [RN-01]

Purpose: record what is known about the Syrian legal framework that affects where Shifa may store patient data and what approvals it needs, separate verified from secondary facts, and turn the gaps into owner actions. This is not legal advice; OD-01 and OD-02 require a Syrian lawyer.

## Correction to earlier research
The first report ([RN-01]) and the Syria environment notes ([RN-03 §2]) stated that Syria had no personal-data-protection law in force as of November 2026. Later research found **Law No. 12 of 2024 on the protection of electronic personal data** [RN-16 §2]. Treat RN-01/RN-03 as superseded on this point.

## Law No. 12 of 2024 (electronic personal data protection)
| Item | What we know | Confidence |
|---|---|---|
| Existence | Listed in the Morrison Foerster privacy library (Syria), which links an Arabic original on the Ministry of Communications site (moct.gov.sy); creates a Personal Data Protection Authority | Secondary source; original text not yet read |
| Effective date | 2025-01-01 | Secondary summary (offlist.me) |
| Article 15 | Transferring, processing or storing personal data in a foreign state is prohibited unless the competent authority verifies and authorises adequate protection | Secondary summary; exact wording not verified |
| Status after the transition | Described as uncertain and under review (2026 report citing SANA) | Secondary source |
| Health-data specifics | No Ministry of Health rule on health-data hosting found | Gap |

Implications for Shifa:
- Hosting patient data outside Syria (Türkiye, EU) may require authorisation once the law is enforced. Architecture must stay portable to an in-Syria data centre ([ADR-0022](../adr/0022-deployment-portable-hosting.md)).
- Development and AI tooling hold no real patient data ([ADR-0023](../adr/0023-no-real-patient-data-in-dev.md)), so the question applies to production and backups.
- Design to GDPR principles anyway: consent, purpose limitation, minimisation, access/correction/deletion rights, breach notification, processor agreements with clinics; HIPAA-style safeguards as the security baseline [RN-03 §2].

## Other instruments and signals
- **January 2025 cabinet circular** (reported 7 Jan 2025): collecting personal data of Syrian citizens or state employees through electronic forms only through the Ministry of Communications and IT and its platforms. Its scope for private apps is unclear; early accreditation reduces the risk [RN-03 §2].
- **Cybercrime Law No. 20/2022**: in force; under review by the Ministry of Justice since June 2026 [RN-03 §2].
- **Electronic Transactions Law No. 3/2014 and E-Signature Law No. 4/2009**: status not re-confirmed; relevant to signed clinical notes and consents [RN-03 §2].
- **E-payment licensing decree No. 1124** (19 Aug 2026): licence needed for e-wallet/payment providers; relevant only if Shifa ever handles payments itself [RN-03 §2].
- **Health-platform approval precedent**: Moadna obtained Ministry of Health approval and temporary approval from the National Authority for IT Services (NAITS) in August 2026 and advertises data hosted inside Syria [RN-11 §1].
- **Licence enforcement in Aleppo**: the Aleppo Health Directorate closed unlicensed clinics (2 Aug 2026) and a private hospital (23 Jul 2026). Shifa verifies each doctor's practice licence before public listing [RN-03 §1].
- **Not found**: telemedicine, e-prescription and records-retention rules; a medical-liability law (Aleppo doctors demanded one in Jul 2026) [RN-03 §2].

## Actions
- OD-01: legal opinion on Law 12/2024 Art. 15 — can production run in a Turkish or EU data centre, with or without authorisation; what an in-Syria primary would require.
- OD-02: Ministry of Health approval and NAITS accreditation path, documents, timeline; start in parallel with Phase 0.
- Obtain and archive the official Arabic text of Law 12/2024 and the Jan 2025 circular.
- Retention: configurable, proposed default in [data handling](data-handling.md) (OD-13).
