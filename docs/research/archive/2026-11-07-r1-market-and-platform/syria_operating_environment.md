# Syria Operating Environment (Aleppo city + Azaz / northern Aleppo countryside) for a Clinic-Management SaaS + Patient Booking App — status as of early November 2026

Research date: 2026-11-07. Web research only. Every finding carries the date of the underlying fact or report. Where only a headline or search snippet was available (several Enab Baladi pages block automated fetching), this is flagged as "(headline/snippet only)".

---

## 1. Health sector structure after Dec 2024 (MoH, Aleppo and Azaz directorates, NGOs, health information systems, medical syndicate)

### Takeaway
The Ministry of Health in Damascus is the single regulator, working through the Aleppo Health Directorate. That directorate is actively licensing and inspecting private facilities in 2026: it closes unlicensed clinics and has shut a private hospital. The former Turkish/SIG-run health system in Azaz is still being absorbed. The process is slow and contentious: a staff strike in February 2026, unpaid salaries, and dozens of centres idle. NGO/WHO funding cuts have hollowed out the north. Health information systems are humanitarian or public-sector (EWARS, HeRAMS, possibly DHIS2 at governorate level). No national EHR or e-prescription system was found. Uniquely relevant: the MoH plus the national IT authority (NAITS) are now approving digital booking and clinic-management platforms.

### Cited Findings
**Ministry of Health and strategy**
- The MoH launched a 2026–2028 Strategic Plan on 15 Dec 2025. It is published on moh.gov.sy and covers infrastructure, governance/partnerships and service delivery. A search-engine summary says it references DHIS2 as a governorate-level health information system. I could not open the PDF (HTTP 404 on fetch), so the DHIS2 detail is unverified. — [MoH strategic plan (AR)](https://www.moh.gov.sy/storage/ar/moh_ar.pdf); [MoH strategic plan (EN)](https://moh.gov.sy/storage/en/moh_en.pdf)
- The MoH publishes weekly EWARS (Early Warning Alert and Response System) bulletins; one exists for Feb 2026. The 2026 Humanitarian Needs and Response Plan cites EWARS reporting from Jan 2026 and says 1,800 acute-watery-diarrhoea alerts were investigated through EWARS in 2025. — [Syria HNRP 2026, Health](https://humanitarianaction.info/plan/1518/document/syria-humanitarian-needs-and-response-plan-2026/article/35-health-3)
- Per HeRAMS 2025 (cited in HNRP 2026), only about 57% of hospitals and 30% of primary health care centres in Syria are fully functional. — [Syria HNRP 2026, Health](https://humanitarianaction.info/plan/1518/document/syria-humanitarian-needs-and-response-plan-2026/article/35-health-3)
- In June 2026, WHO estimated 12.8 million people in Syria needed health assistance. An MSF-supported public centre offers examinations, but patients often buy most medicines from private pharmacies (Oct 2026). — [Enab Baladi English, Oct 2026](https://english.enabbaladi.net/archives/2026/10/msf-supports-over-20-primary-healthcare-centers-in-syria/)
- A Saudi–Syrian MoU covers e-health and digital transformation, and a "virtual health" project was launched linking a hospital in Damascus (snippet only; date not confirmed). SANA (June 2026, snippet only) reported an MoH warning against apps impersonating the ministry, urging use of the "official digital health portal". — [SANA, MoH tag (snippet)](https://sana.sy/tag/%d9%88%d8%b2%d8%a7%d8%b1%d8%a9-%d8%a7%d9%84%d8%b5%d8%ad%d8%a9-%d8%a7%d8%a7%d9%84%d8%b3%d9%88%d8%b1%d9%8a%d8%a9/)

**Digital-health platform approval (important precedent)**
- In Aug 2026, Damascus healthtech startup Moadna (founded 2025) said it had received MoH approval "after meeting the ministry's regulatory and technical requirements". It called itself the first comprehensive booking + clinic-management platform to be approved. It also holds *temporary* approval from the National Authority for Information Technology Services (NAITS) while it completes final accreditation. — [MENA Startup Digest, updated 22 Aug 2026](https://menastartupdigest.com/?p=48912)

**Aleppo Health Directorate: licensing and enforcement (2026)**
- 2 Aug 2026: The Aleppo Health Directorate closed several clinics, cosmetic centres and dental centres in New Aleppo and Mokambo for operating without a legal licence. The closures followed inspection rounds by its Health Facilities Department. — [Enab Baladi, Aug 2026](https://www.enabbaladi.net/819330/%D8%A7%D9%84%D8%B5%D8%AD%D8%A9-%D8%AA%D8%BA%D9%84%D9%82-%D9%85%D8%B1%D8%A7%D9%83%D8%B2-%D8%AA%D8%AC%D9%85%D9%8A%D9%84-%D9%81%D9%8A-%D8%AD%D9%84%D8%A8/?amp=1)
- 23 Jul 2026: On an MoH decision, the directorate temporarily closed the private "al-Shifa Specialty Hospital" (formerly al-Ta'aluf) after violations and medical errors, weeks after a patient death. — [Enab Baladi, Jul/Aug 2026](https://www.enabbaladi.net/817900/%D8%AD%D9%84%D8%A8-%D8%A5%D8%BA%D9%84%D8%A7%D9%82-%D9%85%D8%A4%D9%82%D8%AA-%D9%84%D9%85%D8%B3%D8%AA%D8%B4%D9%81%D9%89-%D8%AE%D8%A7%D8%B5-%D8%A8%D8%B9%D8%AF-%D8%AA%D8%AC%D8%A7%D9%88%D8%B2%D8%A7%D8%AA/?amp=1)
- 26 Jul 2026: The Aleppo branch of the Doctors' Syndicate held a protest against pre-trial detention of medical staff. It demanded a dedicated medical-liability law and specialised courts. — [Enab Baladi, Jul 2026](https://www.enabbaladi.net/818490/%d8%a3%d8%b7%d8%a8%d8%a7%d8%a1-%d8%ad%d9%84%d8%a8-%d9%8a%d8%ad%d8%aa%d8%ac%d9%88%d9%86-%d8%b9%d9%84%d9%89-%d8%a7%d9%84%d8%aa%d9%88%d9%82%d9%8a%d9%81-%d8%a7%d9%84%d8%a7%d8%ad%d8%aa%d9%8a%d8%a7%d8%b7/?amp=1)
- Aug 2025 (headline only): The MoH plans to regulate the operation of clinics and nursing offices. — [Enab Baladi, 2025](https://www.enabbaladi.net/767854/%d8%a7%d9%84%d8%b5%d8%ad%d8%a9-%d8%aa%d8%ae%d8%b7%d8%b7-%d9%84%d8%aa%d9%86%d8%b8%d9%8a%d9%85-%d8%b9%d9%85%d9%84-%d8%b9%d9%8a%d8%a7%d8%af%d8%a7%d8%aa-%d9%88%d9%85%d9%83%d8%a7%d8%aa%d8%a8-%d8%a7/?amp=1)

**Azaz / northern Aleppo countryside: integration status**
- 13 Feb 2026: The "Azaz Health Region" suspended work and closed the Azaz health directorate building in a strike. Staff cited seven months of unfulfilled promises and five months of unpaid salaries, even though new contracts had been signed with the Aleppo Health Directorate at the start of 2026. Operating budgets had also not been disbursed for seven months. — [Syria TV, 13 Feb 2026](https://www.syria.tv/%D8%B1%D9%88%D8%A7%D8%AA%D8%A8-%D9%85%D8%AA%D8%A3%D8%AE%D8%B1%D8%A9-%D9%88%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D9%85%D9%87%D8%AF%D8%AF%D8%A9-%D9%85%D8%B9-%D8%A7%D8%B3%D8%AA%D9%85%D8%B1%D8%A7%D8%B1-%D8%A7%D9%84%D8%A5%D8%B6%D8%B1%D8%A7%D8%A8-%D9%85%D8%A7-%D8%B9%D9%88%D8%A7%D8%A6%D9%82-%D8%AF%D9%85%D8%AC-%D9%82%D8%B7%D8%A7%D8%B9-%D8%A7%D9%84%D8%B5%D8%AD%D8%A9-%D9%81%D9%8A-%D8%A7%D8%B9%D8%B2%D8%A7%D8%B2%D8%9F)
- Same report: the Aleppo Health Directorate collected staff files from the whole northern countryside, including Azaz, and sent them to the MoH and the General Secretariat for approval. The directorate calls this a "gradual restructuring" into the state structure. Facility status:
  - 28 MoH centres in the area were not activated; only 3 (Nubl, al-Zahraa, Fafin) operated.
  - 26 centres taken over from the Turkish administration had mostly stopped because their contracts expired; some ran on volunteers.
  — [Syria TV, 13 Feb 2026](https://www.syria.tv/%D8%B1%D9%88%D8%A7%D8%AA%D8%A8-%D9%85%D8%AA%D8%A3%D8%AE%D8%B1%D8%A9-%D9%88%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D9%85%D9%87%D8%AF%D8%AF%D8%A9-%D9%85%D8%B9-%D8%A7%D8%B3%D8%AA%D9%85%D8%B1%D8%A7%D8%B1-%D8%A7%D9%84%D8%A5%D8%B6%D8%B1%D8%A7%D8%A8-%D9%85%D8%A7-%D8%B9%D9%88%D8%A7%D8%A6%D9%82-%D8%AF%D9%85%D8%AC-%D9%82%D8%B7%D8%A7%D8%B9-%D8%A7%D9%84%D8%B5%D8%AD%D8%A9-%D9%81%D9%8A-%D8%A7%D8%B9%D8%B2%D8%A7%D8%B2%D8%9F)
- 14 Feb 2026 (headline/summary only): Azaz Health ended its strike after an "administrative understanding" on salaries and merging institutions. — [Syria TV, Feb 2026](https://www.syria.tv/%D8%B5%D8%AD%D8%A9-%D8%A7%D8%B9%D8%B2%D8%A7%D8%B2-%D8%AA%D9%86%D9%87%D9%8A-%D8%A5%D8%B6%D8%B1%D8%A7%D8%A8%D9%87%D8%A7-%D8%A8%D8%B9%D8%AF-%D8%AA%D9%81%D8%A7%D9%87%D9%85-%D8%A5%D8%AF%D8%A7%D8%B1%D9%8A-%D8%A8%D8%B4%D8%A3%D9%86-%D8%A7%D9%84%D8%B1%D9%88%D8%A7%D8%AA%D8%A8-%D9%88%D8%AF%D9%85%D8%AC-%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D8%A7%D8%AA)
- 13 Nov 2025: The MoH signed an agreement with the Syria Recovery Trust Fund to support medical services in rural Aleppo (headline only). — [Enab Baladi, Nov 2025](https://www.enabbaladi.net/783730/%D8%A7%D9%84%D8%B5%D8%AD%D8%A9-%D8%AA%D9%88%D9%82%D8%B9-%D8%A7%D8%AA%D9%81%D8%A7%D9%82%D9%8A%D8%A9-%D9%84%D8%AF%D8%B9%D9%85-%D8%A7%D9%84%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A7%D9%84%D8%B7%D8%A8/?amp=1)

**NGOs and funding cuts**
- Jun 2025: The WHO Health Cluster projected that 172 facilities in northwest Syria, including 11 general and 23 specialised hospitals, would run out of funding. — [WHO Health Cluster, 12 Jun 2025](https://healthcluster.who.int/newsroom/news/item/12-06-2025-holding-the-line-how-the-health-cluster-keeps-northwest-syria-s-fragile-health-system-from-collapse)
- A later WHO briefing (late 2025) put the toll at 417 facilities hit by funding cuts, 366 of them suspending or reducing services. Figures vary by date and scope (172 / 178 / 246 / 417). — [WHO EMRO, Bethke remarks](https://www.emro.who.int/syria/news/remarks-by-cristina-bethke-who-acting-representative-to-syria-at-the-un-press-briefing-in-geneva-on-syrias-health-transition-gap.html)

### Inferences
- The regulatory entry point for the product is (a) MoH approval and (b) NAITS accreditation, following the Moadna precedent. Each listed clinic must itself be licensed by the Aleppo Health Directorate. Inspections in 2026 target unlicensed clinics, so a platform that verifies doctors' licence and syndicate numbers before listing them is a trust and compliance advantage.
- Azaz is administratively "in transition": legally under the Aleppo Health Directorate/MoH, but operationally many facilities still follow the legacy NGO or Turkish-era model. Private clinics there likely face lighter, inconsistent oversight in 2026.
- NGO funding cuts push patients toward private clinics, which strengthens demand for private-clinic tools. They also squeeze patients' ability to pay.

### Gaps
- No reliable count of private clinics, private hospitals or registered doctors in Aleppo city or Azaz for 2025–2026.
- Could not verify whether the MoH plan's DHIS2 reference is a live national rollout. No national EHR, unique patient ID or e-prescription initiative was found.
- No official Syrian Doctors' Syndicate rules on clinic advertising or online booking were found. Searches returned only Egyptian syndicate rules (Sep–Oct 2026), which do not apply. The legacy Syrian medical-profession law and syndicate code likely restrict self-promotion, but this is unverified.
- Specific roles of SAMS and UOSSM in 2026 in Azaz/Aleppo were not found.
- The exact criteria of MoH and NAITS approval for digital platforms are not public in the sources found.

---

## 2. Regulation: data protection, e-transactions, cybercrime, records retention, telemedicine, e-prescriptions, data localization

### Takeaway
Syria has no personal-data-protection law in force as of Nov 2026, and no draft was found. The relevant instruments are:
- a Jan 2025 cabinet circular that restricts collecting citizens' personal data via electronic forms to the Ministry of Communications and IT (MoCT) and its platforms;
- the Assad-era Cybercrime Law No. 20/2022, still in force but under review since June 2026;
- the Electronic Transactions Law No. 3/2014 and E-Signature Law No. 4/2009 (status not re-confirmed);
- the new Aug 2026 e-payment licensing decree;
- MoH and NAITS approval for health platforms.

No Syrian telemedicine, e-prescription or medical-records-retention rules were found. A serious product should self-impose GDPR principles and HIPAA-style safeguards.

### Cited Findings
- Jan 2025: The Prime Minister's office issued a circular, reported as 7 Jan 2025. It bars any activity collecting personal data from Syrian citizens or state employees via electronic forms except through the MoCT, framed as protecting data and preventing misuse. Two outlets give slightly different dates. — [Enab Baladi, Jan 2025](https://www.enabbaladi.net/733193/%D8%AD%D9%83%D9%88%D9%85%D8%A9-%D8%AF%D9%85%D8%B4%D9%82-%D8%AA%D8%B6%D8%A8%D8%B7-%D8%AC%D9%85%D8%B9-%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D9%8A%D9%86/?amp=1); follow-up headline "MoCT regulates collection of personal data in Syria" — [Enab Baladi](https://www.enabbaladi.net/749235/الاتصالات-تضبط-جمع-البيانات-الشخصية/)
- Leaked Syrian databases and official documents (passport scans, civil registry records) have been offered for sale on dark-web platforms. An unnamed MoCT official said the issue is handled under a "phased plan", with no legislative timetable given. — [Enab Baladi, "Syrian data at the mercy of dark networks"](https://www.enabbaladi.net/783943/البيانات-السورية-في-مهب-الشبكات-المظل-2/)
- Cybercrime Law No. 20 of 2022 remains in force. In June 2026 the Ministry of Justice announced legal and technical committees would review it, and issued a circular with procedural safeguards. On 24 Jul 2026, Amnesty urged suspending the law, documenting five journalists or activists detained for online expression between Jan and Jun 2026. — [Amnesty International, Jul 2026](https://www.amnesty.org/en/latest/news/2026/07/syria-suspend-use-of-assad-era-cybercrime-law-pending-reform/); [SCM legal review of Law 20/2022](https://scm.bz/en/en-studies/legal-review-of-the-information-crimes-law-no-20-of-2022-en)
- A 2022 legal review notes that Syrian electronic transactions are governed by Electronic Transactions Law No. 3 of 2014. No 2026 amendment of it or of E-Signature Law No. 4/2009 was found. — [SCM legal review](https://scm.bz/en/en-studies/legal-review-of-the-information-crimes-law-no-20-of-2022-en)
- 19 Aug 2026: Presidential decree No. 1124, announced by the Central Bank of Syria, created a licensing system for payment service providers, e-money providers and payment system operators. Firms offering e-wallets need a licence. It imposes governance, cybersecurity and user-protection requirements (details not published in the article). Integration with international systems is a future goal, "not immediate". No data-localization clause was reported. — [Annahar, 19 Aug 2026](https://www.annahar.com/economy/339676/سوريا-تعتمد-نظاما-لترخيص-شركات-الدفع-الإلكتروني-والنقود-الرقمية)
- Health-platform approval: Moadna obtained MoH approval plus temporary NAITS approval (Aug 2026), which shows a de facto approval regime for booking and clinic-management platforms handling patient records. — [MENA Startup Digest, Aug 2026](https://menastartupdigest.com/?p=48912)
- Headline only: "MoCT lifts restrictions on electronic applications" (2025). — [Enab Baladi](https://www.enabbaladi.net/749392/%D8%A7%D9%84%D8%A7%D8%AA%D8%B5%D8%A7%D9%84%D8%A7%D8%AA-%D8%AA%D9%84%D8%BA%D9%8A-%D8%A7%D9%84%D9%82%D9%8A%D9%88%D8%AF-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%D8%A7%D8%AA/?amp=1)
- Doctors in Aleppo publicly demanded a medical-liability law in Jul 2026, which implies none exists yet. — [Enab Baladi, Jul 2026](https://www.enabbaladi.net/818490/أطباء-حلب-يحتجون-على-التوقيف-الاحتياط/)

### Inferences
- With no data-protection law, the binding constraints are political and administrative: the MoCT data-collection circular, MoH/NAITS approval and the cybercrime law. Expect any future Syrian data law to be modelled on GDPR or Gulf data-protection laws, so design to GDPR now:
  - explicit consent;
  - purpose limitation and data minimisation;
  - rights to access, correct and delete;
  - breach notification;
  - DPA-style processor contracts with clinics.
- Use HIPAA safeguards as the security baseline:
  - role-based access;
  - audit logs;
  - encryption at rest and in transit;
  - per-clinic data segregation;
  - backups.
- The MoCT circular could be read to cover a private app collecting citizens' data via online forms. Getting NAITS/MoCT accreditation early reduces this risk.
- Data localization: no explicit requirement was found. Still, government sensitivity, the NAITS approval step and the "sovereign data centres" discourse make a future local-hosting demand for health data plausible. An architecture that can move to an in-country host is a hedge.
- Medical records retention: absent Syrian rules, adopt a conservative default. As a design assumption, keep adult records at least 10 years after the last visit and paediatric records until majority + 10 years; this is not a Syrian legal requirement. Make the period configurable.

### Gaps
- No text of any Syrian personal-data-protection bill. No telemedicine, e-prescription or records-retention regulation was found.
- No confirmation that Law 3/2014 or Law 4/2009 has been amended, or of any certified e-signature provider operating in 2026.
- The exact scope of the Jan 2025 MoCT circular for private-sector apps is unclear.

---

## 3. Sanctions and availability of global tech services (critical)

### Takeaway
The legal sanctions barrier is essentially gone:
- US: comprehensive sanctions ended mid-2025, the Caesar Act was repealed in Dec 2025, and the State Sponsor of Terrorism (SST) designation was rescinded on 24 Aug 2026.
- EU: economic sanctions lifted in May 2025.
- UK: central bank and other entities delisted in Mar–Apr 2025.

Corporate over-compliance lags, however. As of Sep–Oct 2026:
- **Google Play Console:** still excludes Syria as an account country.
- **Meta:** official documentation still lists Syria as ineligible for the WhatsApp Business Platform, both for senders and for WhatsApp users in Syria receiving messages.
- **Twilio:** says it blocks all SMS to Syria from 15 Sep 2025.
- **Apple Developer enrollment for Syria:** unconfirmed.
- **Firebase:** developers report it usable from Syria (anecdotal).
- **Stripe/PayPal:** no evidence of launch.

### Cited Findings
**US**
- 23 May 2025: OFAC General License 25 authorised nearly all transactions prohibited by the Syria Sanctions Regulations. 30 Jun 2025: Executive Order 14312, effective 1 Jul 2025, terminated the Syria national emergency and revoked six EOs, ending the comprehensive program. Targeted SDN listings remain (Assad circle, captagon, ISIS/AQ, Iran proxies). — [Goodwin, Oct 2025](https://www.goodwinlaw.com/en/insights/publications/2025/10/alerts-otherindustries-syria-sanctions-subside); [AA explainer, Aug 2026](https://www.aa.com.tr/en/middle-east/explainer-what-syrias-removal-from-us-terrorism-list-means/4037133)
- Sep 2025: BIS amended the EAR to implement EO 14312. It created License Exception SPP, authorising export/re-export of all EAR99 items (which covers most commercial software and cloud services) to Syria, subject to end-use and end-user rules. Most Commerce Control List (CCL) items still needed licences. — [Morrison Foerster, 29 Sep 2025](https://www.mofo.com/pdf/resources/insights/250929-u-s-relaxes-export-controls-on-syria); [Steptoe](https://www.steptoe.com/en/news-publications/international-compliance-blog/more-relief-for-syria-commerce-and-treasury-ease-export-controls-and-revoke-sanctions.html)
- Law firms in Oct 2025 warned that "specific controls remain that restrict the provision of items to Syria, including software or cloud-based services", and that providers must still screen for listed persons. — [Goodwin, Oct 2025](https://www.goodwinlaw.com/en/insights/publications/2025/10/alerts-otherindustries-syria-sanctions-subside)
- Caesar Act repeal: Section 6211 of the FY2026 NDAA repealed the Caesar Syria Civilian Protection Act of 2019 without conditions, though with periodic reporting requirements. The Senate vote was 77–20. Trump signed the NDAA on 18 or 19 Dec 2025 (sources differ). — [Enab Baladi English, Dec 2025](https://english.enabbaladi.net/archives/2025/12/trump-signs-repeal-of-caesar-sanctions-law/); [Curtis, Mallet-Prevost](https://www.curtis.com/our-firm/news/u-s-repeals-the-caesar-act-in-latest-move-to-ease-syria-sanctions); [Senate Foreign Relations (Shaheen)](https://www.foreign.senate.gov/press/dem/release/icymi-shaheen-secures-repeal-of-caesar-act-sanctions-on-syria-in-annual-defense-bill)
- State Sponsor of Terrorism designation:
  - 8 Jul 2026: Trump notified Congress of intent to rescind it, starting a 45-day review.
  - 24 Aug 2026: rescission took effect after the review ended without congressional objection. HTS's SDGT/FTO designations were also revoked. A US tri-seal (State/Treasury/Commerce) advisory was issued the same day.
  - After rescission, purely civilian US-origin goods, software and technology can generally be exported without an individual licence, but sensitive dual-use items still need case-by-case review.
  — [AA explainer, 25 Aug 2026](https://www.aa.com.tr/en/middle-east/explainer-what-syrias-removal-from-us-terrorism-list-means/4037133); [Thompson Hine, Jul 2026](https://www.thompsonhinesmartrade.com/2026/07/president-trump-announces-initiation-of-recission-of-syrias-designation-as-a-state-sponsor-of-terrorism/); [Tri-seal advisory PDF, 24 Aug 2026](https://static.poder360.com.br/uploads/2026/08/20260824-Advisory-for-Syria-State-Final-1.pdf); [King & Spalding](https://www.kslaw.com/Insights/Articles/The-Modified-U-S-Sanctions-Framework-for-Syria-The-End-of-Comprehensive-Sanctions,-with-Continued)
- 1 Oct 2026 (single source, via search summary): State amended the ITAR to remove Syria from the policy-of-denial list. No confirmed follow-on BIS rule removing anti-terrorism (AT) controls was found. — [Baker McKenzie Sanctions News](https://sanctionsnews.bakermckenzie.com/us-rescinds-syrias-state-sponsor-of-terrorism-designation-and-delists-hayat-tahrir-al-sham/)

**EU and UK**
- EU:
  - Feb 2025: decision CFSP 2025/406 eased most economic restrictions.
  - 28 May 2025: the Council adopted legal acts lifting all economic sanctions except security-based ones, and delisted 24 entities including the Central Bank of Syria. The arms embargo and asset freezes on Assad-linked persons remain.
  - 11 May 2026: the Council repealed the 2011 partial suspension of the EU–Syria Cooperation Agreement.
  - May 2026: listings of former-regime persons renewed (reportedly to June 2027).
  — [EU Delegation/EC, 28 May 2025](https://north-africa-middle-east-gulf.ec.europa.eu/news/syria-eu-adopts-legal-acts-lift-economic-sanctions-syria-enacting-recent-political-agreement-2025-05-28_en); [Arab News, 2026](https://www.arabnews.com/node/2644003); [EUR-Lex Decision 2026/1087](https://eur-lex.europa.eu/eli/dec/2026/1087/oj)
- UK:
  - 6 Mar 2025: delisted 24 entities including the Central Bank of Syria.
  - 24–25 Apr 2025: delisted 12 more, including the Defence and Interior Ministries, via the Syria (Sanctions) (EU Exit) (Amendment) Regulations 2025.
  - Assad-regime individuals remain sanctioned.
  — [Arab News, Mar 2025](https://www.arabnews.pk/node/2592655); [Enab Baladi English, Apr 2025](https://english.enabbaladi.net/archives/2025/04/britain-lifts-sanctions-on-12-syrian-entities/)

**App stores**
- Google Play (consumer store): on 18 Jan 2026, Minister of Communications Abdulsalam Haykal said many users in Syria can now access the Google Play Store without VPNs. Other Google platforms were expected "within weeks", and 40 Syrians working at Google were coordinating with the ministry. — [Anadolu, 18 Jan 2026](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- Google Play Console (developer side), per a volunteer tracker recording Google support replies (third-party, not an official Google page):
  - 16 Sep 2026: Google Play Developer Support said "Syria is not available for app distribution at this time" and suggested choosing "Rest of the world".
  - 21 Sep 2026: Google said "Syria is excluded at the account-country level in the Play Store", with no timeline.
  - Paid apps and in-app purchases are unavailable to Syrian users.
  - Status as of 7 Oct 2026: "Partly available".
  — [UnblockSyria, Google Play Console tracker](https://unblocksyria.com/en/services/google-play-console)
- In Aug 2025, Tech Policy Press reported that Google had restored Ads before Play, and that Syrians were blocked from Firebase and Google Play; GitHub/GitLab blocked Syrian IPs and Docker was inaccessible. That is an older baseline. — [Tech Policy Press, 26 Aug 2025](https://techpolicy.press/syrias-recovery-depends-on-rebuilding-its-digital-infrastructure)
- Apple: no official Apple notice adding Syria to Developer Program enrollment regions or App Store storefronts was found. A ClefinCode blog only *predicted* 2026 inclusion, and claimed App Store downloads worked more consistently from Q3 2025 (secondary claim). A Damascus agency guide (Aug/Sep 2026) describes publishing from Syria but does not address country eligibility. Its advice is to register accounts in the business owner's name, and a D-U-N-S number is needed for an organisation account. — [ClefinCode](https://clefincode.com/blog/global-digital-vibes/en/from-isolation-to-integration-sanctions-lifting-on-syria-the-global-rise-of-syrian-expertiseandmarketpotential); [Codrex, Aug 2026](https://www.codrex.co/insights/publish-app-stores-syria/)

**Cloud and Firebase**
- Jun 2025: EFF argued that restored access to GitHub, AWS and Google Cloud would allow building and deploying without VPNs. It warned that big tech has historically over-complied and been slow to act on sanctions relief. — [EFF, Jun 2025](https://www.eff.org/deeplinks/2025/06/new-digital-dawn-syrian-tech-users)
- 31 Aug and 8 Sep 2026: volunteers and developers reported that Firebase, Google Ads, Gemini, Kaggle and Fedora are now usable from Syria (developer observations, not Google statements). — [UnblockSyria tracker](https://unblocksyria.com/en/services/google-play-console)

**WhatsApp Business Platform**
- Meta's WhatsApp Business Platform support page lists "Businesses in Cuba, Iran, North Korea, Syria, and three sanctioned regions in Ukraine" as not eligible. WhatsApp users in those locations also cannot receive messages sent via the Platform. The page shows no update date; a search snippet indicated a 19 Nov 2025 revision. — [Meta for Developers, WhatsApp Business Platform support](https://developers.facebook.com/documentation/business-messaging/whatsapp/support); also listed by [Vonage help centre](https://api.support.vonage.com/hc/en-us/articles/4406453102868-What-are-the-country-restrictions-for-sending-or-receiving-messages-with-the-WhatsApp-Business-Platform)
- Jul 2026: Meta launched "Business Agent" AI in WhatsApp, including appointment booking. SANA covered this, but nothing indicated availability for Syrian businesses. — [SANA, 9 Jul 2026](https://sana.sy/science-and-technology/2522716/)

**SMS gateways**
- Twilio's Syria guidelines state Twilio "will stop supporting SMS message delivery to Syria effective September 15, 2025", after which all SMS to Syria are blocked. The operator requires alphanumeric sender pre-registration, which Twilio does not support. Two-way SMS, long codes and short codes are unsupported. — [Twilio SMS guidelines, Syria](https://www.twilio.com/en-us/guidelines/sy/sms); earlier Syriatel delivery-failure incident — [IsDown/Twilio incident](https://isdown.app/status/twilio/incidents/433695-sms-delivery-failures-to-syriatel-in-syria)
- Other aggregators still route to Syria:
  - LINK Mobility (updated 30 Apr 2026): sender-ID registration is mandatory for both MTN and Syriatel.
  - ClickSend: "OTP & Transactional messages only. NO MARKETING".
  - Messente: operators overwrite sender IDs with a local long code.
  — [LINK Mobility](https://docs.linkmobility.com/regulatory-guidelines/sender-id/syria); [ClickSend](https://help.clicksend.com/en/articles/84160-syria-963); [Messente](https://support.messente.com/syria-sms-regulations)

**Stripe / PayPal**
- No report of Stripe or PayPal launching in Syria was found as of Nov 2026. The first international Visa/Mastercard acceptance only came on 26 Aug 2026 (see section 4). — [Al-Monitor, Aug 2026](https://al-monitor.com/originals/2026/08/sharaa-taps-visa-syria-reconnects-global-finance-what-know)

### Inferences
- **Android distribution:** A Syrian-registered developer account is still blocked. Realistic paths:
  - a developer or company account registered outside Syria (e.g., a Turkish, UAE or EU entity, or a diaspora co-founder), publishing to "Rest of world";
  - verifying that the app is visible on Play in Syria (consumer Play works for many users since Jan 2026);
  - a direct APK or PWA fallback.
  The app should be free, with no Play Billing. Monetise the SaaS via off-store invoicing to clinics.
- **iOS:** iOS is about 4–5% of users (section 5). A PWA, or an App Store listing via a non-Syrian entity, is enough initially.
- **WhatsApp reminders:** Meta's Cloud API cannot officially message +963 users. Options:
  - Clinics use the WhatsApp Business *app* manually or semi-manually (click-to-chat `wa.me` deep links generated by the system);
  - In-app push notifications via FCM (reported usable from Sep 2026), with a fallback;
  - SMS via a non-Twilio aggregator with a registered sender ID (MTN/Zain + Syriatel), limited to OTP and transactional messages.
  - Azaz patients often hold Turkish (+90) numbers. The Cloud API may work for those recipients, but Meta's restriction is location-based ("WhatsApp users in those locations"), so this is a compliance grey zone. Do not rely on it.
- **Hosting:** Prefer EU providers (Hetzner, OVH) or Turkey/Gulf regions over US hyperscalers, which may still over-comply. The Syrian operating entity, if any, will face KYC friction. Put the cloud contract in a non-Syrian entity's name and keep an exit path to Syrian in-country hosting.
- **Telegram:** Telegram bots have no Syria restriction found and could serve as a secondary notification channel (not verified in this research).

### Gaps
- No official Apple statement on Syria enrollment or storefront as of Nov 2026.
- No official AWS, Azure, GCP, Cloudflare, Hetzner or DigitalOcean country-eligibility statements for Syria found. Status after the SST rescission is unverified.
- No confirmation whether Meta updated its WhatsApp policy after the 24 Aug 2026 SST rescission.
- Turkish (+90) SMS gateway availability was not researched specifically. Turkish routes are generally standard, but they require Turkish İYS/BTK rules for commercial messages; this is from background knowledge, not verified here.

---

## 4. Payments and currency (Aleppo vs Azaz)

### Takeaway
A new Syrian pound (100 old = 1 new) launched in Jan 2026, and the old notes lost legal tender in Aug 2026. Small new notes are scarce. Aleppo city runs on the new SYP, with USD as the reference for larger prices. Azaz and the northern countryside still transact mainly in Turkish lira (as of Jul 2026). Cash dominates. Digital money is growing fast but fragile:
- Sham Cash: 4.2M users, but hit by a liquidity crisis in Aug 2026;
- the Central Bank's e-money licensing decree (Aug 2026);
- international Visa/Mastercard acceptance only since 26 Aug 2026, limited to hotels, restaurants and government points.

The product must be multi-currency (SYP-new, TRY, USD) and cash-first.

### Cited Findings
**Currency redenomination**
- The Central Bank of Syria launched the new currency at the start of 2026, removing two zeros (every 100 old pounds = 1 new pound). The 1,000 new-pound denomination was postponed. — [Enab Baladi](https://www.enabbaladi.net/789700/سوريا-تطلق-عملتها-الجديدة-والألف-مؤجل/); [Al Mamlaka TV](https://www.almamlakatv.com/news/186442-كل-100-ليرة-تعادل-واحدة-إطلاق-عملة-جديدة-في-سوريا-بحذف-صفرين); [Al Jazeera, 22 Jan 2026](https://www.aljazeera.net/ebusiness/2026/1/22/syria-efforts-global-system)
- The exchange window opened in early Jan 2026 for about 90 days and was extended several times, ending on 30 Jul 2026. On 2 Aug 2026 the Central Bank declared the old notes no longer legal tender, allowing deposit/settlement until 6 Aug 2026. Unofficial estimates put replacement above 95% of daily transactions. — [aajsa.com (snippet)](https://www.aajsa.com/economy/%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%8A%D9%85%D8%A9-%D8%AA%D8%B3%D9%82%D8%B7-%D8%B1%D8%B3%D9%85%D9%8A%D8%A7%D9%8B-%D9%85%D9%86-%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84); [Enab Baladi, limited circulation (headline)](https://www.enabbaladi.net/791971/%D8%AA%D8%AF%D8%A7%D9%88%D9%84-%D9%85%D8%AD%D8%AF%D9%88%D8%AF-%D9%88%D8%A8%D8%B7%D8%A1-%D9%81%D9%8A-%D8%B9%D9%85%D9%84%D9%8A%D8%A9-%D8%A7%D8%B3%D8%AA%D8%A8%D8%AF%D8%A7%D9%84-%D8%A7%D9%84%D9%84%D9%8A/?amp=1)
- Small-change shortage: Enab Baladi reports Syrians using old blue 500 notes, chewing gum and medical plasters as change (headline). — [Enab Baladi](https://www.enabbaladi.net/819394/%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D9%88%D9%86-%D9%8A%D8%AA%D8%B9%D8%A7%D9%85%D9%84%D9%88%D9%86-%D8%A8%D8%A7%D9%84%D9%80500-%D8%A7%D9%84%D8%B2%D8%B1%D9%82%D8%A7%D8%A1-%D9%88%D8%A7%D9%84%D8%B9%D9%84/?amp=1)

**Northern Aleppo (Azaz) vs Aleppo city**
- Jul 2026: In the northern countryside formerly held by the opposition, businesses and institutions refused old SYP, and the Turkish lira "remains the currency most widely used". New SYP circulates in all denominations but small new notes (10 and 25, equal to 1,000 and 2,500 old) are scarce. In Aleppo city, old low-value notes still circulated widely at that time. — [Enab Baladi English, Jul 2026](https://english.enabbaladi.net/archives/2026/07/merchants-reject-old-syrian-pound-as-central-bank-remains-silent/)
- 11 Jul 2026 (summary only): "The Turkish lira is still the adopted currency for financial transactions [in northern Syria], with weak presence of the local currency." — [Arabi21, 11 Jul 2026](https://arabi21.com/stories/t/50063/0/%D8%AD%D9%84%D8%A8)
- Background: the Turkish lira was adopted in northwestern Syria from June 2020. In Sep 2020, the Azaz supply department obliged market traders to deal in TRY. — [Enab Baladi, 2020](https://www.enabbaladi.net/416792/%d8%aa%d9%85%d9%88%d9%8a%d9%86-%d8%a7%d8%b9%d8%b2%d8%a7%d8%b2-%d8%aa%d9%84%d8%b2%d9%85-%d8%a7%d9%84%d8%a3%d9%87%d8%a7%d9%84%d9%8a-%d8%a8%d8%a8%d8%af%d8%a1-%d8%a7%d9%84%d8%aa%d8%b9%d8%a7%d9%85/?amp=1)
- Aleppo city 2025: fluctuations in foreign-currency transactions burden residents (Jun 2025). — [Enab Baladi English, Jun 2025](https://english.enabbaladi.net/archives/2025/06/fluctuations-in-foreign-currency-transactions-burden-people-of-aleppo/?so=related)

**Cards and banks**
- Visa signed an agreement with the Central Bank (reported Dec 2025) and held workshops with Syrian institutions (Feb 2026). In May 2026, the Central Bank authorised licensed banks and payment companies to work with Visa and Mastercard. On 26 Aug 2026, Visa and Mastercard announced international card payments were live:
  - Visa's first transaction ran via Lebanon's Fransabank (acquirer) and Syrian processor Paymera.
  - QNB completed the first end-to-end Mastercard transaction.
  - Acceptance is at participating hotels, restaurants and government entities via POS.
  — [Al-Monitor, 27 Aug 2026](https://al-monitor.com/originals/2026/08/sharaa-taps-visa-syria-reconnects-global-finance-what-know); [Enab Baladi, QNB (May 2026)](https://www.enabbaladi.net/807269/qnb-القطرية-تطلق-خدمات-قبول-بطاقات-الدفع/); [Enab Baladi, first Visa/Mastercard trial in 15 years](https://www.enabbaladi.net/807777/); [The New Arab, Visa deal](https://www.newarab.com/news/visa-plans-syria-launch-after-deal-central-bank-digital-payments)

**E-wallets**
- Sham Cash:
  - The government adopted it as a channel for paying public salaries in early 2025.
  - It reported more than 4.2 million users and about 2 million transfers per day (May 2026).
  - Jul 2026: it announced compliance with Central Bank licensing and transparency demands; it was reportedly forced to link to banks.
  - Aug 2026: a liquidity crunch meant salaries visible in accounts could not be withdrawn.
  - Majalla raised security concerns about the app.
  — [Al-Modon, 7 Jul 2026](https://www.almodon.com/arabworld/2026/07/07/%D8%B4%D8%A7%D9%85-%D9%83%D8%A7%D8%B4-%D8%AA%D9%85%D8%AA%D8%AB%D9%84-%D9%84%D9%85%D8%B7%D8%A7%D9%84%D8%A8-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2%D9%8A-%D8%AA%D8%B1%D8%AE%D9%8A%D8%B5-%D8%A7%D9%84%D8%AA%D8%B7%D8%A8%D9%8A%D9%82-%D9%88%D8%A7%D9%84%D8%B4%D9%81%D8%A7%D9%81%D9%8A%D8%A9); [Al-Modon, 20 Aug 2026](https://www.almodon.com/economy/2026/08/20/%D8%B4%D8%A7%D9%85-%D9%83%D8%A7%D8%B4-%D8%B1%D9%88%D8%A7%D8%AA%D8%A8-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D9%8A%D9%86-%D9%85%D9%88%D8%AC%D9%88%D8%AF%D8%A9-%D9%84%D9%83%D9%86-%D9%84%D8%A7-%D8%B3%D8%AD%D9%88%D8%A8%D8%A7%D8%AA-%D8%A3%D9%8A%D9%86-%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9); [Majalla](https://www.majalla.com/node/325386); [Enab Baladi, "From cash to screen"](https://www.enabbaladi.net/810301/من-النقد-إلى-الشاشة-هل-تدخل-سوريا-عصر-ا/)
- 19 Aug 2026: e-payment / e-money licensing decree No. 1124 (see section 2). — [Annahar](https://www.annahar.com/economy/339676/سوريا-تعتمد-نظاما-لترخيص-شركات-الدفع-الإلكتروني-والنقود-الرقمية)
- A local booking competitor (Doctor Book) advertises a 200 new-SYP credit for bookings, which shows that new-SYP pricing is already in use in the market. — [doctorbook.ai](https://doctorbook.ai/) (search snippet only; page content not retrievable)

### Inferences
- Price display:
  - Aleppo city: new SYP (labelled clearly, e.g., "ل.س جديدة"), with optional USD reference.
  - Azaz: TRY.
  - Support per-clinic currency and an "old-pound equivalent" helper during the transition; people still think in old units, e.g., "400 ألف" = 4,000 new.
- Inferred from Oct 2025 data (400,000 old SYP ≈ USD 40), the rate was roughly 10,000 old ≈ 100 new SYP per USD. Use a live rate source; do not hard-code.
- Payments in the MVP:
  - collect consultation fees at the clinic (cash);
  - optionally record e-wallet payments (Sham Cash; Syriatel Cash / MTN-now-Zain Cash, if operational) as a payment method, not via integration;
  - SaaS subscription billing for clinics in cash, by bank/e-wallet transfer or through diaspora payers abroad.
  Integrating a licensed Syrian PSP becomes possible once licences under decree 1124 are issued.
- Deposits or prepaid bookings to reduce no-shows are hard: cards are barely accepted, and wallet trust was dented by Sham Cash's Aug 2026 liquidity crisis.

### Gaps
- No 2026 data found on Syriatel Cash or MTN Cash user numbers or merchant/bill-payment status, nor on what happened to MTN Cash after Zain's takeover.
- No data on Turkish payment rails used in Azaz in 2026 (PTT branches, Papara, Turkish bank accounts, Al-Haram and other remittance offices).
- The official new-SYP/USD rate in Nov 2026 was not retrieved.

---

## 5. Telecom, connectivity, electricity, devices and messaging habits

### Takeaway
- **Mobile:** Syria is a two-operator market. Syriatel continues. MTN Syria has exited, and its licence/network is being taken over by Kuwait's Zain; reported full commercial launch is in Q1 2027.
- **Azaz:** has historically run on Turkish networks (Turkcell, Türk Telekom, Vodafone TR) and local ISPs with Turkish upstream. No 2026 evidence of a switch-over was found.
- **Internet:** about 9.5M users (35.8% penetration) and 21.2M mobile connections (Oct 2026). Mobile data is faster than fixed: about 25 Mbps mobile median vs about 3 Mbps fixed.
- **Devices:** Android dominates (about 95%).
- **Electricity in Aleppo:** improved in early 2026 (16–20 h/day in some neighbourhoods) but remains unreliable, with a province-wide outage in May 2026.

The product must be offline-tolerant and mobile-first.

### Cited Findings
**Operators**
- Kuwait's Zain won a Syrian mobile licence for USD 747M, valid for up to 25 years (other reports say 20). Ownership is reported as Zain 75% / Syrian state 25% via the sovereign fund. Zain pledged about USD 800M in infrastructure investment, including 5G. A six-month transition maintains service for about 6.3M MTN Syria subscribers; SIM cards do not need replacing. Full commercial operation is expected in Q1 2027. — [Annahar](https://www.annahar.com/economy/326153/%D8%B2%D9%8A%D9%86-%D8%A7%D9%84%D9%83%D9%88%D9%8A%D8%AA%D9%8A%D8%A9-%D8%AA%D8%B5%D8%A8%D8%AD-%D8%AB%D8%A7%D9%86%D9%8A-%D9%85%D8%B4%D8%BA%D9%84-%D9%84%D8%B4%D8%A8%D9%83%D8%A9-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84%D8%A7%D8%AA-%D9%81%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D9%88%D8%AA%D8%AA%D8%B9%D9%87%D8%AF-%D8%A8%D8%A5%D8%B3%D8%AA%D8%AB%D9%85%D8%A7%D8%B1-800-%D9%85%D9%84%D9%8A%D9%88%D9%86-%D8%AF%D9%88%D9%84%D8%A7%D8%B1); [Semafor, 1 Jul 2026](https://www.semafor.com/article/07/01/2026/kuwaiti-telecom-zain-group-lands-syria-mobile-license); [Al-Monitor, Jun 2026](https://www.al-monitor.com/originals/2026/06/kuwaits-zain-eyes-15b-mobile-network-postwar-syria-what-know); [intellinews](https://www.intellinews.com/syria-awards-zain-second-5g-mobile-operating-licence-452051/); [MEA Tech Watch, MTN exit](https://meatechwatch.com/?p=47979)
- Syriatel returned to Idlib and began selling SIMs there in Jan 2025. No equivalent 2026 report was found for northern Aleppo/Azaz. — [Enab Baladi, Jan 2025](https://www.enabbaladi.net/733691/)
- Northern Aleppo:
  - Internet companies in northwest Syria relied fully on Turkish upstream providers.
  - Residents use local "4G" lines, "Ailux" (riding on Turkcell towers) and Turkish SIMs (2024).
  - Türk Telekom opened its first service centre in northern Aleppo in 2018, with Arabic customer service.
  - The Azaz local council has required telecom companies to be licensed (2020).
  — [Enab Baladi, 2024](https://www.enabbaladi.net/718927/سكان-ريف-حلب-مشتتون-بين-4g-وأيلوكس-والت/); [Enab Baladi, 2018/2020](https://www.enabbaladi.net/402439/)
- Starlink: the national telecom regulator warned that unlicensed satellite internet (including Starlink) exposes users and distributors to legal liability, and offered an 80% spectrum-fee cut for licensed "WiFi Outdoor" services. A security campaign confiscated Starlink devices (headline). On 24 Jul 2026, Enab Baladi raised questions over possible restrictions on Starlink. No Starlink licence in Syria was found. — [Enab Baladi, MoCT warns on Starlink](https://www.enabbaladi.net/737077/الاتصالات-تحذر-من-ستارلينك-وتقترح-حل/); [Enab Baladi, Starlink confiscation](https://www.enabbaladi.net/791825/حملة-أمنية-تصادر-أجهزة-ستارلينك-في-دي/); [Enab Baladi, Jul 2026](https://www.enabbaladi.net/817895/%D9%82%D9%8A%D9%88%D8%AF-%D9%85%D8%AD%D8%AA%D9%85%D9%84%D8%A9-%D8%AA%D8%AB%D9%8A%D8%B1-%D8%AA%D8%B3%D8%A7%D8%A4%D9%84%D8%A7%D8%AA-%D8%AD%D9%88%D9%84-%D9%85%D8%B3%D8%AA%D9%82%D8%A8%D9%84-%D8%B3%D8%AA/?amp=1)

**Usage and speeds**
- DataReportal (Digital 2027 Syria, data as of Oct 2026):
  - population 26.7M, 82.3% urban, median age 23.8;
  - internet users 9.54M (35.8%), up 297k (+3.2%) year on year;
  - 21.2M cellular connections (79.5% of population), 95% of them 3G/4G/5G broadband;
  - social-media user identities "N/A".
  — [DataReportal, Digital 2027: Syria](https://datareportal.com/reports/digital-2027-syria)
- DataReportal Digital 2026 Syria (Ookla): median mobile download 24.69 Mbps; median fixed download 3.35 Mbps. — [DataReportal, Digital 2026: Syria](https://datareportal.com/reports/digital-2026-syria)
- Aleppo city broadband (Apr 2025–Mar 2026) averaged 3.8 Mbps; by provider, Starlink 13.4 Mbps, High Speed Telecom 6.8, Syrian Telecom 2.5. — [Speedgeo, Aleppo](https://www.speedgeo.net/statistics/syrian-arab-republic/aleppo)
- StatCounter mobile OS share, Syria:
  - Android 96.32% / iOS 3.67% (Jun 2026);
  - Android 94.69% / iOS 5.3% (Aug 2026);
  - a Sep 2026 view with Windows at 11.56% appears to be a mixed-category artefact.
  — [StatCounter, Syria mobile OS](https://gs.statcounter.com/os-market-share/mobile/syrian-arab-republic)

**Electricity**
- Jul 2025: some Aleppo neighbourhoods had about 2 hours of supply per day, with cuts of up to 22 hours. — [Enab Baladi, Jul 2025](https://www.enabbaladi.net/766653/%d9%8a%d8%b5%d9%84-%d8%a5%d9%84%d9%89-22-%d8%b3%d8%a7%d8%b9%d8%a9-%d8%aa%d9%82%d9%86%d9%8a%d9%86-%d8%a7%d9%84%d9%83%d9%87%d8%b1%d8%a8%d8%a7%d8%a1-%d9%8a%d8%b9%d8%b7%d9%84-%d8%a7%d9%84%d8%ad%d9%8a/?amp=1)
- Feb 2026: supply rose to 16–20 h/day in some Aleppo neighbourhoods. The Aleppo electricity company director promised the increase was permanent, but other neighbourhoods had repeated multi-day faults and some eastern districts had no grid at all. — [Enab Baladi, Feb 2026](https://www.enabbaladi.net/795620/)
- 20 May 2026: power was cut across Aleppo governorate after the thermal plant went offline and high-voltage lines faulted (Syria TV tag page). Jun 2026: Nubl and al-Zahraa relied on generators after a tower was damaged. Jul 2026: rationing increased nationally "without schedules". — [Syria TV, Aleppo thermal plant tag](https://www.syria.tv/tag/%D8%A7%D9%84%D9%85%D8%AD%D8%B7%D8%A9-%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D9%8A%D8%A9-%D9%81%D9%8A-%D8%AD%D9%84%D8%A8); [Enab Baladi, Jun 2026](https://www.enabbaladi.net/811319/بعد-تضرر-برج-التوتر-نبل-والزهراء-تحت-ع/); [Enab Baladi, Jul 2026](https://www.enabbaladi.net/817648/%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1-%D9%81%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D8%AA%D8%B5%D8%A7%D8%B9%D8%AF-%D8%A7%D9%84%D8%AA%D9%82%D9%86%D9%8A%D9%86-%D8%A8%D9%84%D8%A7-%D8%AC%D8%AF/?amp=1)
- Aleppo industrialists face higher electricity prices (2026, headline). — [Enab Baladi](https://www.enabbaladi.net/807380/%D9%83%D9%8A%D9%81-%D9%8A%D9%88%D8%A7%D8%AC%D9%87-%D8%B5%D9%86%D8%A7%D8%B9%D9%8A%D9%88-%D8%AD%D9%84%D8%A8-%D8%A7%D8%B1%D8%AA%D9%81%D8%A7%D8%B9-%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D9%83%D9%87/?amp=1)
- Azaz: electricity has been supplied by private Turkish companies (e.g., AK Energy) under contracts with local councils, with recurring merchant complaints (2018–2021 reporting). No 2026 data was found. — [Enab Baladi, 2021](https://www.enabbaladi.net/503799/); [Enab Baladi, Turkish company supplies Azaz](https://www.enabbaladi.net/212457/شركة-تركية-تؤمّن-الكهرباء-لمدينة-اعزا/)

### Inferences
- Design for Android first:
  - low-end devices and small APKs;
  - an offline-first clinic app with a local cache and a sync queue, because clinic Wi-Fi/ADSL drops with power cuts, and secretaries may run on a phone hotspot;
  - mobile data (about 25 Mbps) is more reliable than fixed (about 3 Mbps).
- The Zain transition (through Q1 2027) may disrupt SMS routing and sender-ID registration for ex-MTN numbers. Plan to re-register sender IDs with Zain.
- Azaz users frequently carry Turkish SIMs (+90), so phone fields must accept both +963 and +90. OTP delivery to Turkish numbers is easier than to Syrian ones.

### Gaps
- No 2026 data on Azaz mobile/ISP market shares or on Syriatel coverage in Azaz.
- No authoritative WhatsApp or Telegram penetration figures for Syria (DataReportal lists social-media identities as N/A). Background knowledge that WhatsApp is the dominant messaging app is not sourced here.
- No 2026 electricity-hours data for Azaz, and none for Aleppo after Jul 2026.

---

## 6. How private clinics operate in Aleppo / Azaz today

### Takeaway
Private clinics in Aleppo price themselves, typically USD 20–40 equivalent per consultation in late 2025. They largely ignore MoH fee schedules, and the syndicate tolerates this. Patients increasingly go private because public facilities are overcrowded and under-equipped. In Azaz, local councils historically set doctors' fees in TRY. Secretary and phone booking, walk-in queues (nizam al-dor), evening clinics and doctors working in several places are widely known practices but are poorly documented in citable sources.

### Cited Findings
- Oct 2025, Aleppo: consultation fees rose across almost all specialties, with gaps of up to 2x between doctors. Examples: urologist 400,000 old SYP (about USD 40, i.e., 4,000 new SYP); paediatric neurologist 200,000 old SYP. — [Enab Baladi, Oct 2025](https://www.enabbaladi.net/776854/%D8%A3%D9%87%D8%A7%D9%84%D9%8D-%D9%8A%D8%B4%D8%AA%D9%83%D9%88%D9%86-%D8%A7%D9%84%D8%A7%D8%B1%D8%AA%D9%81%D8%A7%D8%B9-%D8%A7%D9%84%D9%85%D8%B2%D9%85%D9%86-%D9%84%D9%84%D9%85%D8%B9%D8%A7%D9%8A%D9%86/?amp=1)
- Jun 2024: the MoH raised official consultation fees about 600%, regardless of specialty. — [Enab Baladi English, Jun 2024](https://english.enabbaladi.net/archives/2024/06/syrian-health-ministry-raises-medical-examination-fees-by-600/)
- Nov 2024, Aleppo: fees were applied non-uniformly. Variation was attributed to clinic rent, equipment and taxes. An Aleppo medical-syndicate source said the syndicate "tacitly overlooked" overcharging. — [Enab Baladi English, 28 Nov 2024](https://english.enabbaladi.net/archives/2024/11/increasing-examination-fees-burden-patients-in-aleppo/)
- 2021: fees were not enforced by the syndicate or directorate; doctors set their own prices, which vary by neighbourhood. — [Enab Baladi, 2021](https://www.enabbaladi.net/524428/?amp=1)
- Sep 2025: patients are "trapped" between incapable public hospitals and unaffordable private care. Example: an MRI costs about 500,000 SYP (about USD 50). — [Enab Baladi English, Sep 2025](https://english.enabbaladi.net/archives/2025/09/awaiting-recovery-syrias-health-sector-traps-patients/)
- Azaz (historical): the local council set doctors' and lab fees, with controversy over check-up fees in the north (2020). — [Enab Baladi, Azaz council sets doctor/lab fees](https://www.enabbaladi.net/402371/محلي-اعزاز-يحدد-أجور-الأطباء-والتحال/); [Enab Baladi English, Jun 2020](https://english.enabbaladi.net/archives/2020/06/medical-check-ups-fees-raise-controversy-in-northern-syria/)
- In Latakia, patients use pharmacists' prescriptions and Facebook as alternatives to costly consultations (headline), indicating price sensitivity. — [Enab Baladi](https://www.enabbaladi.net/663432/?amp=1)
- Roshtah's booking model (below) is built around reserving a place in the queue and tracking queue progress remotely, which reflects the prevailing queue (dor) system. — [Roshtah](https://www.roshtah.com/%D8%A7%D8%AD%D8%AC%D8%B2-%D8%B7%D8%A8%D9%8A%D8%A8)

### Inferences
- The product's core flow should model queue-number booking (حجز دور) with live queue position, alongside fixed time slots. It also needs:
  - a secretary-centric web or Android console (phone and walk-in entry);
  - multi-location doctor schedules (doctors with several clinics or hospital shifts);
  - evening sessions;
  - fee recording in SYP or TRY.
- Paper records dominate (no sources contradict this), so onboarding should allow quick digitisation of the essentials: patient card, visit note, prescription print.
- Pharmacy and lab links: patients buy medicines privately even after public consultations. A printable or shareable prescription and lab-request feature (QR/WhatsApp share) fits behaviour, even without a national e-prescription system.

### Gaps
- No 2026 citable survey of clinic workflows: secretary booking, queue systems, paper records, evening hours, multi-site doctors, pharmacy/lab referral and kickback relationships.
- No 2026 consultation-fee data for Azaz, and no new-currency fee schedule for Aleppo.

---

## 7. Local and regional competitors

### Takeaway
Several young Syrian booking platforms exist (2025–2026): Moadna (MoH-approved, Damascus-centric, about 560 doctors), Roshtah (queue booking + HMS), Doctor Book and Rahim. Aleppo coverage is thin; Moadna lists 107 Aleppo doctors. No competitor focused on Azaz or northern Aleppo was found. Regional giants (Vezeeta, Okadoc, Altibbi) were not found operating in Syria.

### Cited Findings
- Moadna ("ع موعدنا", moadna.com):
  - "first Syrian platform specialised in online medical booking";
  - founded 2025 in Damascus;
  - MoH approval and temporary NAITS approval (Aug 2026);
  - more than 12,000 users, 560 doctors, more than 4,500 bookings;
  - features: booking, scheduling, patient records, billing and expenses;
  - directory counts: Damascus 203, Aleppo 107, Latakia 98, Hama 63, Rif Dimashq 56, Homs 46, Tartus 32, Idlib 18 and others;
  - top specialty listed: dentistry (290).
  — [moadna.com](https://moadna.com/); [MENA Startup Digest, Aug 2026](https://menastartupdigest.com/?p=48912)
- Roshtah (roshtah.com, by Magara Soft):
  - covers Damascus, Aleppo, Homs and "all cities" in Syria;
  - free for patients; the fee is paid to the doctor at the clinic, or prepaid for online consultations;
  - queue reservation with live queue tracking; doctor page link and QR;
  - apps on Google Play and the App Store plus a PWA;
  - "HMS" hospital management system with 32 modules, plus clinic appointments and records;
  - directory pages also for Egypt, the Gulf states and Turkey.
  — [Roshtah](https://www.roshtah.com/%D8%A7%D8%AD%D8%AC%D8%B2-%D8%B7%D8%A8%D9%8A%D8%A8)
- Doctor Book (doctorbook.ai): describes itself as a medical booking platform in Syria for doctors, centres, labs and radiology, with a 200 new-SYP booking credit promotion (search snippet; page content not retrievable). — [doctorbook.ai](https://doctorbook.ai/)
- Rahim (ra-him.com): booking for doctors and centres in Syria, with consultations, tests and operations (snippet only). — [ra-him.com](https://ra-him.com/)

### Inferences
- The market is early and fragmented, and Aleppo is under-served relative to its size: Moadna's 107 Aleppo doctors vs 203 in Damascus. Azaz/north is untouched.
- Differentiation options:
  - depth of clinic management, not just a booking directory;
  - offline-first operation;
  - TRY + SYP support;
  - +90/+963 phone support;
  - a diaspora booking flow.
- Moadna's MoH/NAITS approval is a competitive moat to match quickly.

### Gaps
- No pricing data for any Syrian competitor's doctor subscription.
- Not verified: Google Play listings, install counts or ratings of these apps; Syrian desktop clinic software (local "برنامج عيادات" vendors); Turkish apps (e.g., e-Nabız/MHRS) used by Azaz residents for Turkish care.

---

## 8. Diaspora / Turkey angle and cross-border care (Azaz–Kilis)

### Takeaway
About 2.28M Syrians remain under temporary protection in Turkey (May 2026). About 0.67–0.76M have returned since Dec 2024. Turkey introduced healthcare contribution fees and ended free coverage for new cases from 1 Jan 2026, which pushes some care-seeking back into Syria. That makes a "book and pay for family in Syria from abroad" flow, and TRY pricing in the north, relevant. No 2026 data was found on medical referrals through Bab al-Salama/Kilis.

### Cited Findings
- Turkey introduced healthcare contribution fees for Syrians under temporary protection from 1 Jan 2026, and ended free coverage eligibility for new cases from 1 Jan. — [UNHCR Türkiye Annual Results Report 2025 (Jun 2026)](https://www.unhcr.org/sites/default/files/2026-06/unhcr-annual-results-report-2025-turkiye.pdf); [Daily Sabah](https://www.dailysabah.com/politics/turkiye-takes-new-steps-to-encourage-returns-to-syria/news)
- As of May 2026, about 1.7M Syrians had returned from neighbouring countries since Dec 2024, about 667,000 of them from Türkiye. The Interior Minister cited 763,443 returns (cut-off unclear). 2,280,542 Syrians were under temporary protection (DGMM, May 2026). — [Baker Institute](https://www.bakerinstitute.org/research/evolving-protection-landscape-syrian-refugees-turkiye); [Asylum in Europe (AIDA) Türkiye](https://asylumineurope.org/reports/country/turkiye/overview-main-changes-previous-report-update/)
- Oct 2026: Turkey's 2027 budget projects only 210,000 Syrian returns in 2026 vs 700,000 planned. — [Enab Baladi English, Oct 2026](https://english.enabbaladi.net/archives/2026/10/turkey-lowers-forecast-for-syrian-returns-in-2026/)
- Aug 2026: Turkey continued upgrading its Syria border crossings. — [Enab Baladi English, Aug 2026](https://english.enabbaladi.net/archives/2026/08/turkey-continues-upgrading-syria-border-crossings/)
- Historical referral channel: Bab al-Hawa resumed cancer-patient entry to Turkish hospitals via referrals from the Idlib oncology department, about 90 patients per week (2023). — [Enab Baladi, 2023](https://www.enabbaladi.net/652029)

### Inferences
- Diaspora payers in Turkey and Europe have cards and PayPal, but Syrian merchants cannot easily receive card payments. A diaspora "pay for a relative's consultation" feature therefore needs a non-Syrian merchant of record, settling to clinics via cash/hawala or a licensed Syrian PSP later.
- Rising Turkish healthcare costs for Syrians plus returnees create demand for trusted, bookable private care in Azaz, Afrin and al-Bab. Arabic + Turkish UI and TRY pricing matter there.

### Gaps
- No 2026 data on Bab al-Salama/Öncüpınar (Azaz–Kilis) medical referrals or cross-border medical travel volumes.
- No data on diaspora booking behaviour or remittance volumes earmarked for health.
