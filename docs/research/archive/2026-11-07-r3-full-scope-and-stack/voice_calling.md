# Voice Calling (نداء صوتي) for Clinic Waiting Rooms — Queue Announcements for a Multi-Tenant Clinic SaaS (Aleppo / Azaz)

Research date: 7 November 2026. Prices and versions are as found on that date (sources dated where possible). Web research only; nothing local was inspected.

## 1. How professional queue-management systems structure announcements (chime, number, counter/room, languages, hardware)

### Takeaway
Commercial systems (Qmatic, cleverQ, Wavetec, and low-cost hardware vendors) converge on the same pattern: an optional attention tone, then "ticket number N, go to counter/room C", configurable text, either pre-recorded files or built-in TTS, a primary plus optional secondary language, played on the display device itself (often an Android media-player app) or on network speakers. Detailed vendor docs on recall buttons, volume schedules and repeat counts are not public; those features have to be designed from first principles.

### Cited Findings
- Qmatic's voice-announcement module "announc[es] counter and ticket numbers when calling customers forward", can play specific sounds when a customer is called, and is meant to be combined with queue info on displays — [Qmatic Voice Announcements](https://www.qmatic.com/products/voice-announcements)
- Qmatic offers two audio sources: pre-recorded voice files (delivered via the Qmatic Display App or a media player) and AI TTS built into the Display App (write text → choose language/voice → generate), with male and female voices, 50+ languages including Arabic; TTS is pitched as a way to cut the cost of recording new announcements — [Qmatic Voice Announcements](https://www.qmatic.com/products/voice-announcements)
- The Qmatic Display App is "a media player app for Android" delivering media, queue status and voice announcements — i.e., the leading vendor plays audio from an Android box behind the TV — [Qmatic Voice Announcements](https://www.qmatic.com/products/voice-announcements)
- Announcements can run in a local language plus a secondary language; Qmatic's example plays English followed by Spanish — [Qmatic Voice Announcements](https://www.qmatic.com/products/voice-announcements); [Qmatic product update (search snippet)](https://www.qmatic.com/product-updates/new-apps-for-certified-hardware)
- Qmatic accessibility: "Call visitors in their preferred language based on the language selected during booking or check-in" — [Qmatic Accessibility Features](https://www.qmatic.com/products/accessibility-features)
- Legacy Qmatic "Choral" voice-unit docs list message formats from a bare ticket-number call up to "Now serving ticket number N. Please go to counter C.", custom voice strings, and one voice unit serving many queues (seen via search snippet; page fetch failed) — [Iowa DOT Qmatic Choral help](https://testpartners.iowadot.gov/help/Standard%20Unit%20Types%20Guide/18_01%20displays.5.11.html)
- cleverQ (German vendor): announcement covers ticket number and the room/place; texts are "freely configurable" with computer voices or uploaded self-recorded audio; playback via monitors, waiting-area displays or network/wired speakers; centrally managed from the workstation; positioned as an accessibility aid for low-vision people and those not watching the screen — [cleverQ Audio Output](https://cleverq.de/en/modules/audio-output)
- A UK single-counter voice module offers an optional "ding dong" tone before each announcement — [TecStore Voice1 module (search snippet)](https://www.tecstore.co.uk/product_info.php/other-qms-accessories-single-counter-voice-module-voice1-p-3325); similar multi-counter speech units exist — [Lonsto EasyTurn multicounter speech unit](https://www.lonsto.co.uk/easyturn-multicounter-speech-unit)
- Very low-cost market segment: wireless 2-digit queue displays "with voice calling and remote control buttons" are sold as commodity hardware — [IndiaMart listing](https://m.indiamart.com/proddetail/wireless-queue-management-system-2-digit-display-with-voice-calling-and-remote-control-buttons-2856535238488.html)
- Wavetec lists "Voice Announcements — keep your customers updated through audio" but publishes no language/engine detail; a third-party G2 listing names Arabic among 13 supported languages (unverified) — [Wavetec features](https://www.wavetec.com/solutions/spectra-queue-analytics-software/features/); [SourceForge/G2 listing](https://sourceforge.net/software/product/Wavetec-Queue-Management/)
- G2 comparison: Qminder shows "AI Text-to-Speech: Feature Not Available", Wavetec 8.0 (5 reviews) — [G2 Qminder vs Wavetec](https://www.g2.com/compare/qminder-vs-wavetec)
- Qmatic separately launched "Qmatic Aiva", a multilingual conversational AI voice agent — not the same thing as waiting-room announcements — [Qmatic Aiva launch](https://www.qmatic.com/qmatic-insights/qmatic-launches-qmatic-aiva-ai-voice-agent-for-enterprise-customer-journeys)

### Inferences
- The de-facto announcement grammar is: [attention chime] → [number] → [destination] → (repeat) → (second language). Ours should be: chime (~1 s) → "الرقم {N}" → "إلى {عيادة الدكتور X / غرفة Y}" → optional repeat → optional Turkish pass for Azaz.
- Leading vendors moved to "TTS generated once in the admin tool, played as files on an Android display app". That is exactly the hybrid we need for unreliable internet: generate centrally, play locally.
- Qminder (a modern SaaS competitor) apparently lacks AI TTS, so good Arabic voice calling is a real differentiator in this niche.

### Gaps
- No public detail found for Q-nomy, Aurionpro/Akis, JRNI announcement sequences, recall-button behaviour, volume schedules, or repeat counts; vendor manuals are behind sales/support logins.
- Turkish "sıramatik" and Arabic "نظام الدور الصوتي" vendor pages did not surface in searches (results were nurse-call/PA systems or AI phone receptionists); local vendor conventions in Syria/Türkiye remain undocumented here.

## 2. Calling by number vs by name — privacy expectations in healthcare waiting rooms

### Takeaway
Calling names is not illegal under HIPAA-style regimes if limited and safeguarded, but every guidance source treats "name + being called to a specific clinic/doctor" as a disclosure of health information and recommends minimisation: numbers, first-name-only, patient-chosen alias, never clinical details. Default to number-only, with name calling as an opt-in per clinic and opt-out per patient.

### Cited Findings
- HHS (HIPAA): the Privacy Rule permits incidental disclosures that occur as a by-product of permitted ones, including other patients overhearing a name called in a waiting room, provided reasonable safeguards and minimum-necessary limits apply (e.g., sign-in sheets must not show medical problems). Page returned 403 to the fetcher; content per search snippet — [HHS FAQ: sign-in sheets / calling names](https://www.hhs.gov/hipaa/for-professionals/faq/may-health-care-providers-use-sign-in-sheets/index.html)
- Health PEI (Canada) waiting-room call-out guidance: using a person's name plus the fact they are being called into an appointment in a specific waiting room is a disclosure of their PHI; mitigations include asking patients what name they want used, calling by first name only, and using number systems or text alerts (per search snippet; PDF text not extractable) — [Health PEI Waiting Room Call-out Guidance (2024)](https://src.healthpei.ca/sites/src.healthpei.ca/files/ATIP/Waiting_Room_Call-out_Guidance.pdf)
- UK GPs asked the MDU whether LED boards showing the patient's name, the doctor and the consultation-room number could breach confidentiality (2006, historical) — [Digital Health, 2006](https://www.digitalhealth.net/2006/05/offer-alternatives-to-self-check-in-gps-advised)
- An NHS patient-feedback post describes a calling-screen system letting staff set an "alias" for patients who do not want their name displayed — [Care Opinion](https://www.careopinion.org.uk/96989)
- NHS Lothian confidentiality guide: overheard details about other patients "can immediately undermine their trust in our standards of confidentiality" — [NHS Lothian Confidentiality Guide (2023)](https://policyonline.nhslothian.scot/wp-content/uploads/2023/03/Confidentiality%20-%20A%20Guide%20to%20Good%20Practice%20and%20Procedures.pdf)
- NHS England phone guidance (analogous principle): identify yourself and your organisation but do not give specifics about the service or purpose — [NHS England IG guidance](https://nhsd-proxy.openprescribing.net/data-and-information/information-governance/guidance/protecting-peoples-confidentiality-and-privacy-on-the-telephone)
- Medical Economics: ask patients how they prefer to be addressed — [Medical Economics](https://medicaleconomics.com/view/ask-patients-how-they-prefer-be-addressed)

### Inferences
- The destination itself can leak health information (e.g., "to the psychiatrist", "to the gynaecology clinic"). Announce a neutral room label ("غرفة ٢" / "العيادة ٢") by default; announcing the doctor's name should be a clinic setting.
- Name mode, if enabled, should use only the first name (or a patient-chosen alias) plus the number, never a family name, age or reason for visit. A per-patient "do not announce my name" flag should be set at registration.
- Small Syrian clinics traditionally call names aloud, so a number-first system improves privacy over the status quo, which is a selling point.

### Gaps
- No Syrian data-protection rule or Ministry of Health guidance on waiting-room announcements was found. No Turkish (KVKK) guidance specific to name masking on calling screens was found either; searches returned only generic KVKK notices.
- The full text of NHS-specific call-out policies was not retrieved; UK practice appears to rest on general UK GDPR/confidentiality principles plus local trust policy.

## 3. Pre-recorded clip concatenation and Arabic number grammar

### Takeaway
Arabic number–noun agreement (gender polarity for 3–10, agreement for 1–2 and 11–12, tamyīz case rules) makes on-the-fly concatenation of counted phrases error-prone. Queue announcements avoid this by treating the number as a label ("الرقم ٢٣") that needs no counted noun. The simplest robust approach is whole-number clips 1–999 (or a full-phrase clip per number), generated once with a high-quality voice, plus a few fixed phrases.

### Cited Findings
- Arabic numerals 3–10 take the opposite gender of the singular counted noun; 1, 2, 11 and 12 agree with it; from 11–99 the counted noun is singular indefinite accusative (manṣūb); from 100 up it is singular genitive; in long compound numbers the noun follows the rule of the last number — [Kalimah Center: Arabic numbers grammar](https://kalimah-center.com/arabic-numbers-grammar/); [SubLearn: compound numbers 11–19](https://sublearn.com/learn/ar/grammar/ar-cardinal-numbers-11-19-compound-numbers)
- A TTS normaliser must check the singular noun's gender (e.g., ورقة is feminine, so its number takes the masculine form) — [Kalimah Center](https://kalimah-center.com/arabic-numbers-grammar/)
- There is at least one npm package (arabicfmt) with a "counted-noun engine" that takes grammatical gender and drives number agreement plus singular/dual/plural noun forms — [arabicfmt type defs on jsDelivr](https://cdn.jsdelivr.net/npm/arabicfmt@0.1.2/dist/count-C4U_RQ2h.d.ts)
- cleverQ and Qmatic both support uploading self-recorded audio files as an alternative to TTS — [cleverQ](https://cleverq.de/en/modules/audio-output); [Qmatic](https://www.qmatic.com/products/voice-announcements)

### Inferences
- Use the label construction "الرقم {N}" ("Number N"). As a label, N is read as a plain cardinal, which avoids counted-noun agreement. Avoid templates like "{N} مراجعين".
- Clip bank options:
  - (a) 999 whole-number clips, best prosody, about 999 × ~1.2 s, or roughly 3–4 MB at 24–32 kbps Opus/MP3.
  - (b) About 40 compositional units (1–19, tens, hundreds, the connector "و"). Smaller, but the joins sound robotic, and Arabic order ("ثلاثة وعشرون", "مئة وثلاثة وعشرون") still needs care.
  - (c) Best: one full-phrase clip per number, "الرقم ثلاثة وعشرون", plus per-room destination clips. That is two joins only.
- Generating the bank via cloud TTS is a one-off cost of cents. 999 phrases × ~20 characters ≈ 20k characters, about US$0.30 at $15/1M (see §5). Commissioning a human voice-over in Levantine is a viable premium alternative.
- Register: neutral MSA spoken with a Syrian-accent voice (e.g., Azure ar-SY) is probably the most acceptable compromise for clinics in Aleppo and Azaz. This needs validation with real clinic owners.
- If multi-doctor clinics use letter prefixes (A12, B12), they need letter clips in Arabic and Turkish. Per-doctor number ranges (Dr A 1–199, Dr B 200–399) avoid that.

### Gaps
- No source found on how Arab or Turkish queue vendors actually phrase numbers (MSA vs dialect, whole number vs digit-by-digit) or on any Syrian vendor's recorded clip set.
- No evidence found on how cloud TTS engines handle Arabic number agreement in practice (failure rates).

## 4. Browser Web Speech API (speechSynthesis) for Arabic

### Takeaway
speechSynthesis is free and built in, but Arabic voice availability is device-dependent and often network-backed. On Android, Chrome silently falls back to an English voice if the Arabic pack is not downloaded. It is unsuitable as the primary engine and acceptable only as a last-resort fallback after an on-device test.

### Cited Findings
- getVoices() is populated asynchronously in Chrome, Edge and Firefox; read the list in a voiceschanged handler — [Readium: SpeechSynthesis in browsers and OSes](https://readium.org/speech/docs/WebSpeech.html); [MDN getVoices mirror](https://www-igm.univ-mlv.fr/~forax/MDN/developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices.html)
- Each voice has a localService flag. Google's remote voices in Chrome do not work offline — [Stack Overflow: Chrome speechSynthesis offline](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/29870590/can-t-chrome-s-speechsynthesis-work-offline)
- On Android, most voices have offline and online variants. If the selected language needs a voice-pack download, Chrome defaults to an English voice — [Readium](https://readium.org/speech/docs/WebSpeech.html)
- Arabic language tags differ by platform (ar_SA on Windows, ar-001 on iOS). The workaround is to match any voice whose lang starts with "ar" — [Anki forum](https://forums.ankiweb.net/t/using-native-tts-on-multi-platforms/59600)
- Fully Kiosk Browser exposes "Text to speech" via its JavaScript interface, using the Android TTS engine. This is a PLUS-only feature — [Fully Kiosk feature list](https://www.fully-kiosk.com/docs/en/features/all)

### Inferences
- Pronunciation of undiacritised Syrian names by OS voices will be inconsistent, and voices differ across TV boxes. That breaks the "professional, consistent" requirement.
- Use speechSynthesis or Fully's Android TTS only when the pre-generated clip pack is missing or corrupt. Check for a voice with lang starting "ar" and localService === true. Otherwise play chime + visual only.

### Gaps
- No 2025–2026 source confirms which Arabic voices ship offline on Android TV, Google TV, ChromeOS or Windows 11 (Windows desktop "Hoda/Naayf" and Edge's online Azure "Natural" voices are known from prior knowledge but were not verified here).

## 5. Cloud neural TTS options: Arabic (incl. ar-SY) and Turkish voices, pricing, access from/for Syria

### Takeaway
Azure is the only major cloud with explicit Syrian Arabic voices (ar-SY-AmanyNeural, ar-SY-LaithNeural) plus Turkish (tr-TR-EmelNeural, tr-TR-AhmetNeural). Google has 30 Chirp 3 HD MSA voices (ar-XA) and cheap WaveNet. Polly has only Gulf/MSA Arabic. ElevenLabs is the most expensive. At clinic volumes, cost is negligible (cents to a few dollars per clinic per month), often within free tiers. The real constraint is access: call the TTS API only from the SaaS backend hosted outside Syria under a non-Syrian account, and never from clinic devices.

### Cited Findings
- **Azure AI Speech, Arabic:** neural voices exist for 16 Arabic locales, including ar-SY (AmanyNeural F, LaithNeural M), ar-LB (LaylaNeural, RamiNeural), ar-JO (SanaNeural, TaimNeural), ar-SA, ar-EG and others. All are "Standard" neural voices with no styles/roles — [Microsoft Learn: language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
- **Azure, Turkish:** tr-TR-AhmetNeural (male; added Dec 2020) and tr-TR-EmelNeural (female) — [Microsoft Tech Community, Dec 2020](https://techcommunity.microsoft.com/t5/azure-ai/azure-neural-text-to-speech-updates-51-new-voices-added-to-the/ba-p/1988418); [JSON2Video Emel](https://json2video.com/ai-voices/azure/voices/tr-tr-emelneural/)
- **Azure pricing (third-party; official page did not render):**
  - Standard neural ≈ $15 per 1M characters (citing the Azure retail prices API, 18 Oct 2026); another source says $16.
  - Neural HD ≈ $22–30 per 1M.
  - F0 free tier: 0.5M characters per month.
  - Sources: [DevelopersDigest](https://www.developersdigest.tech/models/speech/azure); [CostBench](https://costbench.com/software/ai-voice-tools/microsoft-speech/); [LiteLLM](https://docs.litellm.ai/docs/providers/azure_ai_speech); [Azure pricing page](https://azure.microsoft.com/pricing/details/cognitive-services/speech-services)
- **Google Cloud TTS, Arabic:** ar-XA (MSA, "ar-001") has 4 Standard, 4 WaveNet and 30 Chirp3-HD voices, and no Neural2 — [Google Cloud voice list](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- **Google pricing:**
  - Standard and WaveNet: $4 per 1M characters, with 4M free per month.
  - Neural2: $16 per 1M.
  - Chirp 3 HD: $30 per 1M, with 1M free.
  - Studio: $160 per 1M.
  - Gemini TTS: billed per token ($1/1M input text tokens, $20/1M audio tokens).
  - The Instant custom voice price conflicts between localized pages ($4 vs $60).
  - Source: [Google Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing?hl=he)
- **Amazon Polly, Arabic:** Zeina is a standard (non-neural) MSA voice. Hala (F, 2022) and Zayd (M) are neural Gulf Arabic (ar-AE), and Hala also speaks MSA via the "arb" tag. Sources conflict on Zayd's launch date (Aug 2023 vs Aug 2024) — [AWS Polly available voices](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html); [AWS What's New 2023](https://aws.amazon.com/about-aws/whats-new/2023/08/amazon-polly-gulf-arabic-male-ntts-voice); [AWS What's New 2022](https://aws.amazon.com/about-aws/whats-new/2022/11/amazon-polly-neural-tts-support-polish-arabic)
- **Polly pricing:**
  - Standard: $4 per 1M characters (5M free per month).
  - Neural: $16 per 1M (1M free per month for the first 12 months).
  - Generative: $30 per 1M.
  - Long-Form: $100 per 1M.
  - Source: [AWS Polly pricing](https://aws.amazon.com/polly/pricing/)
- **ElevenLabs (third-party, Sept 2026):**
  - Flash/Turbo: $0.05 per 1k characters (= $50 per 1M).
  - Multilingual v2/v3: $0.10 per 1k (= $100 per 1M).
  - Some resellers quote slightly lower.
  - Flash v2.5 supports 32 languages and Multilingual v2 supports 29; Arabic was not confirmed in the retrieved sources.
  - Sources: [ModelsLab](https://modelslab.com/elevenlabs-api-pricing); [Puter dev guide (Jun 2026)](https://developer.puter.com/tutorials/elevenlabs-api-pricing/)
- **Access, legal:** after the 2025 lifting of US country-based sanctions, sanctions "are no longer a bar to providing cloud-based services or software in or to Syria", but export controls still apply to some software/technology, so providers must assess risk — [Goodwin, Oct 2025](https://www.goodwinlaw.com/en/insights/publications/2025/10/alerts-otherindustries-syria-sanctions-subside); [EFF, Jun 2025](https://www.eff.org/deeplinks/2025/06/new-digital-dawn-syrian-tech-users)
- **Access, Google:** services began resuming in Syria; Google Play is reachable without VPN and most platforms were expected to follow "within weeks" (18 Jan 2026). Google Cloud is not mentioned — [Anadolu Agency, 18 Jan 2026](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- **Access, Microsoft:** the Microsoft Store returned, but Microsoft 365 and Azure were reported as still restricted for Syrian businesses and developers — [Levant24](https://levant24.com/en/article/microsoft-store-returns-to-syria-amid-digital-restrictions)
- **Access, AWS:** "partly available"; the AWS Console was listed as blocked for Syrian users (30 Mar 2026). Amazon acknowledged a Feb 2026 request without a decision. Page updated 18 Sep 2026 — [UnblockSyria: AWS](https://unblocksyria.com/en/services/aws)

### Inferences
- Cost model (Azure, $15/1M):
  - The number/room clip pack is a one-off, under $1 per voice per language.
  - Name clips: about 60 characters per announcement × 1,000 new patients per month ≈ 60k characters ≈ $0.90 per clinic per month before free tiers.
  - Caching per unique name cuts this further, since recurring patients reuse audio.
  - Google WaveNet ($4/1M, 4M free) is cheaper but MSA-only and less natural. Chirp 3 HD ($30/1M) is likely the most natural Google option.
- Architecture requirement: TTS calls happen server-side from the SaaS backend (hosted in, e.g., the EU or Türkiye, billed to a non-Syrian legal entity). Clinic devices download only MP3/Opus files from our own server or CDN. This sidesteps end-user geo-blocking. Vendor ToS and export-control review is still needed.
- Recommended primary voice: Azure ar-SY-LaithNeural / AmanyNeural, with tr-TR-AhmetNeural / EmelNeural for Azaz. Fallback vendor: Google Chirp 3 HD ar-XA. Because generated clips are cached files, switching vendors later only means regenerating the pack.

### Gaps
- No official Azure TTS price was rendered; the ~$15–16/1M figure is third-party.
- Whether Azure or Google ToS allow serving end users in Syria from a non-Syrian account was not confirmed from primary vendor pages.
- Quality of ar-SY voices on undiacritised Syrian names was not benchmarked; no published comparison was found.
- Turkish Google/Polly voice lists were not retrieved (page truncation).

## 6. Open-source / offline TTS options (Piper, MMS, XTTS, Kokoro, newer Arabic models)

### Takeaway
As of Nov 2026, the only clearly commercial-friendly, good-quality open Arabic TTS found is SILMA TTS v1 (Apache-2.0 weights, MSA + English, ~150M params). Most Arabic open models are non-commercial: MMS-TTS ara (CC-BY-NC-4.0), XTTS-v2 (CPML), the Levantine Leva-TTS (CC-BY-NC) and Arabic-TTS-Spark. Piper's only Arabic voice (ar_JO kareem) has unclear dataset licensing, and Piper's engine moved to GPL-3.0. Offline TTS is best used server-side or on a local box to pre-generate clips, not on cheap TV boxes.

### Cited Findings
- **SILMA TTS v1:**
  - Weights Apache-2.0, code MIT; ~150M parameters; Arabic Fuṣḥa/MSA + English.
  - Voice cloning from under 8 s of reference audio.
  - RTF ≈ 0.12 on an RTX 4090.
  - Accepts text with or without tashkeel; missing diacritics are added automatically by CATT.
  - Built on F5-TTS; 2026 release (blog dated 15 March).
  - Sources: [silma-ai/silma-tts model card](https://huggingface.co/silma-ai/silma-tts); [SILMA blog](https://huggingface.co/blog/silma-ai/opensource-arabic-english-text-to-speech-model)
- **Leva-TTS:** a Levantine Arabic + English code-switching fine-tune of XTTS-v2, licensed CC-BY-NC-4.0 (non-commercial) — [mohammedaly22/leva-tts](https://huggingface.co/mohammedaly22/leva-tts)
- **Arabic-TTS-Spark:** released under a non-commercial license — [IbrahimSalah/Arabic-TTS-Spark](https://huggingface.co/IbrahimSalah/Arabic-TTS-Spark)
- **ArTST (MBZUAI):** TTS focused on MSA; dialect extension planned — [ArTST GitHub](https://github.com/mbzuai-nlp/ArTST); also [MBZUAI speecht5_tts_clartts_ar](https://huggingface.co/MBZUAI/speecht5_tts_clartts_ar)
- **Meta MMS-TTS Arabic (facebook/mms-tts-ara):** tagged cc-by-nc-4.0, so not usable commercially — [facebook/mms-tts-ara](https://huggingface.co/facebook/mms-tts-ara)
- **Coqui XTTS-v2:**
  - Weights are under the Coqui Public Model License (non-commercial).
  - The Coqui TTS library code is MPL-2.0.
  - Coqui shut down (Dec 2023/Jan 2024), and there is no confirmed route to a commercial license.
  - An Arabic XTTS fine-tune inherits CPML.
  - Sources (secondary): [LocalAIMaster](https://localaimaster.com/blog/xtts-coqui-commercial-license); [Coqui GitHub discussion #4145](https://github.com/coqui-ai/TTS/discussions/4145); [Moeeldouma/arabic-tts-xtts-v2](https://huggingface.co/Moeeldouma/arabic-tts-xtts-v2)
- **Piper, Arabic voice:** ar_JO "kareem" in low and medium quality — [rhasspy/piper-voices tree](https://huggingface.co/rhasspy/piper-voices/tree/main/ar/ar_JO/kareem)
  - Its MODEL_CARD: fine-tuned from the US-English "lessac" medium voice; 1 speaker; 22,050 Hz.
  - The dataset is only linked (github.com/AliMokhammad/arabicttstrain), with no license stated. The repo-level tag is MIT.
  - Source: [kareem MODEL_CARD](https://huggingface.co/rhasspy/piper-voices/blob/main/ar/ar_JO/kareem/medium/MODEL_CARD)
- **Piper voice licensing in general:** each voice carries the license of its training data, and many Piper voices are non-commercial. Treat kareem as non-commercial until verified — [tts.ai Piper Kareem](https://tts.ai/voices/piper-kareem-arabic/); [voicechanger.live](https://voicechanger.live/text-to-speech/arabic)
- **Piper engine:** rhasspy/piper (MIT) was archived in Oct 2025. Development moved to OHF-Voice/piper1-gpl under GPL-3.0, possibly because of the espeak-ng dependency. An MIT fork "piper-plus" claims to drop espeak-ng (unverified) — [Cekura](https://www.cekura.ai/discover/piper-tts); [PromptQuorum Piper review](https://www.promptquorum.com/power-local-llm/piper-tts-review); [piper-plus](https://github.com/ayutaz/piper-plus/)
- **Piper, Turkish voices:** tr_TR dfki, fahrettin, fettah (medium, 22,050 Hz). dfki is reported (secondary source) as CC BY-NC-SA 4.0 — [piper-voices tr_TR](https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0/tr/tr_TR); [dfki MODEL_CARD](https://huggingface.co/rhasspy/piper-voices/blob/6fb8245d6d27fef8988272e0c8e9f5018da1bbbf/tr/tr_TR/dfki/medium/MODEL_CARD)
- Piper runs on low-end CPUs such as a Raspberry Pi — [AIVideoSensei Piper on Raspberry Pi](https://aivideosensei.com/guides/piper-tts-offline-voice-guide)

### Inferences
- For a commercial SaaS, the only clean self-hosted Arabic path found is SILMA TTS (Apache-2.0), MSA only. It could run on the SaaS server (GPU or CPU, speed unknown) to generate name clips without paying a cloud vendor and without Syria-access issues. It is worth a quality bake-off against Azure ar-SY on 200 common Syrian names.
- None of the open models is suitable to run on a $30–60 Android TV box at announcement time. Use them only for server-side pre-generation.
- Avoid MMS, XTTS, Leva-TTS and Piper-kareem in production unless a license is cleared.

### Gaps
- Kokoro language coverage was not verified this session (believed not to include Arabic; check the model card).
- SILMA CPU inference speed and Levantine quality are unknown.
- The kareem dataset license and lessac base-model terms were not confirmed.
- No 2026 benchmark comparing open Arabic TTS models was found.

## 7. Arabic diacritization (tashkeel) and name pronunciation

### Takeaway
Undiacritised names are the main quality risk. Character-level diacritizers like CATT (open-sourced, reported better than GPT-4-turbo on its benchmark, and already used by SILMA TTS) can pre-process text. The most reliable production approach, though, is a curated name lexicon plus a receptionist "preview and correct" step, with the resulting audio cached per normalised name.

### Cited Findings
- CATT (Character-based Arabic Tashkeel Transformer), fine-tuned from a character-based BERT, reports a relative DER 9.36% better than GPT-4-turbo on its dataset. Models and benchmark are open-sourced on GitHub (abjadai/catt); third-party verification lists the results as unverified, and the repo has about 67 stars — [CATT arXiv 2407.03236](https://arxiv.org/abs/2407.03236v3); [SOTAverified](https://sotaverified.org/papers/catt-character-based-arabic-tashkeel)
- SILMA TTS uses CATT to add tashkeel automatically when input lacks it — [silma-ai/silma-tts](https://huggingface.co/silma-ai/silma-tts)
- CAMeL Tools is an open-source Python collection of Arabic NLP tools — [CAMeL Tools via PapersWithCode task page](https://astro.paperswithcode.com/task/arabic-text-diacritization)

### Inferences
- Pipeline at registration time:
  1. Normalise the name (strip tatweel, unify alef/yaa/taa-marbuta variants).
  2. Look it up in a tenant-shared lexicon of diacritised names. Seed it with the most common Syrian first names, since first-name-only calling keeps the lexicon small.
  3. On a miss, run CATT (or an LLM) to propose tashkeel.
  4. Generate the clip.
  5. Show a ▶ preview button and an editable "pronunciation" field to the receptionist; corrections feed back into the shared lexicon.
- Cache key: hash(normalised_name + tashkeel + voice_id + engine_version). Store the MP3/Opus on the server and share it across all tenants. Names repeat heavily, so the hit rate grows quickly and per-clinic cost tends toward zero.
- Turkish names in Azaz are Latin-script and need no diacritization. Arabic names announced in the Turkish pass should be written in Turkish orthography (e.g., "Muhammed") in a separate optional field.

### Gaps
- Licenses for CATT, CAMeL Tools, Mishkal and Farasa were not confirmed; no search results covered Mishkal or Farasa licensing.
- No accuracy data was found for diacritizing personal names specifically (benchmarks are on running text).
- LLM-based tashkeel accuracy for Syrian names was not measured.

## 8. Playback hardware and the browser/device platform (autoplay, kiosk, wake, reconnect, multi-room)

### Takeaway
Browsers block audible autoplay without a user gesture unless policy allows it. Kiosks solve this with Chrome's AutoplayAllowlist enterprise policy, with Fully Kiosk Browser (autoplay audio, keep-screen-on, autostart and auto-reload on reconnect in the free tier; kiosk lockdown, remote admin, scheduling and JS TTS in a one-time PLUS licence of roughly €6–8 per device), or with a one-time "tap to enable sound" activation. A cheap Android TV box or Android phone/tablet behind the TV mirrors Qmatic's own Android display-app approach.

### Cited Findings
- **Chrome autoplay:**
  - Muted autoplay is always allowed. Sound requires user interaction with the domain, a crossed Media Engagement Index (desktop), or an installed PWA / home-screen site (mobile).
  - Enterprise policies AutoplayAllowed and AutoplayAllowlist exist for kiosks and unattended systems.
  - The test flag --autoplay-policy=no-user-gesture-required disables the policy.
  - A Web Audio AudioContext created before a gesture starts "suspended" and must be resume()d after one.
  - Source: [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- **Fully Kiosk Browser:**
  - Free tier: "Autoplay HTML5 video/audio", keep screen on, autostart on boot, auto-reload when the network reconnects / wait for network instead of error pages; supports Android 6 to 17.
  - PLUS only: kiosk mode, remote admin, scheduled sleep/wake by weekday, MQTT, JavaScript TTS.
  - Source: [Fully Kiosk feature list](https://www.fully-kiosk.com/docs/en/features/all)
- Fully also offers an advanced keep-screen-on mode for Android 10+ (v1.44+) — [Fully device management docs](https://www.fully-kiosk.com/docs/en/configuration/device-management)
- Fully PLUS is a one-time licence: about £8 (third-party) or from €6 per device (Capterra), with volume keys for 10+ devices. One Capterra reviewer criticised the remote admin — [Capterra: Fully](https://www.capterra.com/p/156468/Fully/)
- **Screen Wake Lock API:**
  - navigator.wakeLock.request("screen") keeps the screen on; HTTPS-only.
  - The lock is auto-released when the page is hidden, so re-acquire it on visibilitychange.
  - Baseline 2025 (all current browsers since Mar 2025) but may fail on older devices; feature-detect.
  - Source: [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- Qmatic's display/voice endpoint is an Android media-player app — [Qmatic](https://www.qmatic.com/products/voice-announcements)
- cleverQ plays through monitors and displays, or through network speakers and wired systems — [cleverQ](https://cleverq.de/en/modules/audio-output)

### Inferences
- **Device ranking for Syrian clinics** (cheap, repairable, tolerant of power cuts):
  1. The reception PC itself driving the TV over HDMI as an extended second screen. The display is a second browser window, and calls pass between windows via BroadcastChannel, so they keep working with zero internet. Audio goes through the TV speakers over HDMI. Cheapest, and offline by construction for single-room clinics.
  2. An Android TV box ($25–60) or old Android phone running Fully Kiosk PLUS, wired to the TV over HDMI or to a powered speaker over 3.5 mm.
  3. A smart-TV built-in browser. Last choice: inconsistent autoplay and service-worker support, sleep behaviour, and vendor browsers.
- Prefer wired audio over Bluetooth speakers. Bluetooth speakers auto-sleep and drop pairing after power cuts. If Bluetooth is unavoidable, play a near-silent keep-alive or choose speakers without auto-off.
- **Power cuts:** a small UPS or power bank on the router and the display box keeps announcements alive through short cuts. Autostart-on-boot plus the cached audio pack recovers automatically after long cuts.
- **Reconnect:**
  - Use SSE or WebSocket with heartbeat and exponential backoff.
  - On reconnect, fetch the authoritative queue state so the TV never shows stale numbers.
  - Include a monotonically increasing call_id so the display never replays an old call after reconnecting.
  - Report a "display online / last heartbeat / last played call_id" acknowledgement back to the receptionist UI.
- **Multi-room / branches:**
  - Each display device registers to a zone (branch → waiting area). Calls carry zone_id, and only displays in that zone play them. One clinic can have several waiting areas with separate speakers.
  - Optional: the doctor's tablet or phone can be a "room" endpoint that plays a soft chime when the patient is called, or shows "patient called, waiting" status.

### Gaps
- Fully Kiosk's official PLUS price and Android TV / Google TV support were not confirmed (the FAQ entry exists but its answer was not retrieved).
- Service-worker and Cache Storage reliability on specific cheap TV-box Chromium builds was not researched.
- No Syria-specific hardware price data was found.

## 9. Receptionist / doctor UX for voice calling

### Takeaway
No vendor manual detailing call-control UX was retrievable. Vendors confirm the core actions (call to a counter/room, multiple queues per voice unit, configurable text, second language), and the rest follows established queue-UX practice. The key engineering points are a serialised audio queue on the display, idempotent call events, and a visible "display is online / sound played" acknowledgement.

### Cited Findings
- A single Qmatic voice unit announces ticket numbers from many queues, with formats including number + counter — [Iowa DOT Qmatic Choral (search snippet)](https://testpartners.iowadot.gov/help/Standard%20Unit%20Types%20Guide/18_01%20displays.5.11.html)
- Language per visitor, chosen at booking or check-in, drives the announcement language — [Qmatic Accessibility](https://www.qmatic.com/products/accessibility-features)
- Announcements are configurable text or uploaded recordings, centrally managed from the workstation — [cleverQ](https://cleverq.de/en/modules/audio-output)
- Cheap hardware queue systems use physical "remote control buttons" for calling — [IndiaMart listing](https://m.indiamart.com/proddetail/wireless-queue-management-system-2-digit-display-with-voice-calling-and-remote-control-buttons-2856535238488.html)

### Inferences
- **Receptionist/doctor actions** (Arabic UI labels):
  - التالي / call next: per doctor, one big button plus a keyboard shortcut.
  - إعادة النداء / recall: replays the same call_id. Apply a cooldown of ~5 s, show a "recalled ×2" badge, and suggest "no-show" after N recalls.
  - نداء مريض محدد / call specific: pick from the list.
  - لم يحضر / skip-no-show: move to the end or mark as missed, with a reason.
  - إلغاء النداء / cancel call: if pressed by mistake within ~3 s, before audio starts.
- **Doctor-side calling:** a minimal mobile web page on the doctor's phone with "next" and "recall" buttons for their room. This removes the receptionist bottleneck in multi-doctor clinics.
- **Display audio queue:**
  - FIFO with de-duplication (ignore an identical call_id arriving twice) and a minimum gap between announcements (~1.5 s).
  - Cap queue length; when two doctors call at once, play sequentially and highlight both on screen.
  - Never overlap audio.
- **Volume:** a per-display master volume and a per-time-slot volume schedule (lower in the evening; quiet mode). Add a "test sound" button for the receptionist.
- **Background content:**
  - If the TV page plays its own background media (health tips video or music), duck it to ~20% during the chime and speech, then restore.
  - If the TV is showing a broadcast channel or another app, the web app cannot duck it. Recommend that the TV runs only our display app.
- **Dual-language for Azaz:**
  - Setting per clinic: Arabic only, Arabic → Turkish, or per-patient language.
  - Template: chime → Arabic phrase → short pause → Turkish phrase (e.g., "{N} numara, {oda} odasına"), wording to be validated by a native speaker.
  - Total length about 6–8 s per call; no full repeat by default in dual mode.
- **Call log:** call_id, patient_id/number, doctor/room, called_by, timestamp, recall count, outcome (seen / no-show), display ack. This also provides wait-time and service-time analytics for the clinic owner.
- **Repeat policy:** play once by default and offer "repeat twice" as a clinic setting. Elderly-heavy clinics benefit from the double play.

### Gaps
- No published usability study on queue-calling UX in Arabic clinics was found.
- Recall/no-show defaults (cooldowns, max recalls) are not documented by vendors; values above are design proposals, not sourced.

## 10. Accessibility (hearing-impaired, elderly, low vision)

### Takeaway
Voice and visual channels must be redundant: audio for low-vision patients and anyone not watching the screen (cleverQ's stated rationale), and a strong visual flash and on-screen history for deaf or hard-of-hearing patients. Language choice per patient is an accessibility feature in itself (Qmatic).

### Cited Findings
- Audio output exists for people with low vision and those not looking at screens — [cleverQ](https://cleverq.de/en/modules/audio-output)
- Calling visitors in their preferred language is listed among Qmatic's accessibility features — [Qmatic Accessibility](https://www.qmatic.com/products/accessibility-features)
- Displays combined with announcements show queue information throughout the waiting area — [Qmatic](https://www.qmatic.com/products/voice-announcements)

### Inferences
- **Visual:**
  - On each call, flash a full-screen overlay for ~8–10 s with the number in very large digits (Arabic-Indic or Western digits per clinic setting), the room label, and a colour pulse. Keep the overlay in sync with the audio.
  - Keep a "last 5 calls" list permanently visible.
  - Use high contrast and no thin fonts.
- **Elderly patients:**
  - Slightly slower speech rate (TTS rate −10%).
  - Chime before speech, then the announcement repeated twice.
  - Short, consistent phrasing.
  - Offer reception the option to tap a patient as "needs assistance" so staff fetch them in person.
- **Optional:** an SMS or WhatsApp "you are next" notification. WhatsApp is ubiquitous in Syria, but it brings messaging costs and needs consent. It is out of MVP scope.

### Gaps
- No healthcare-specific accessibility standard for waiting-room calling displays was retrieved (e.g., WCAG does not cover physical signage).
- No data on hearing-loss prevalence in the target patient population.

## 11. Recommended MVP design (synthesis)

### Takeaway
Ship a "pre-generated audio, played locally" design. A server-generated, versioned clip pack (chime + "الرقم N" for 1–999 + room/doctor phrases, Arabic with an ar-SY voice, Turkish optional) is cached on the display device and works with no internet. Name clips are an opt-in layer generated server-side at registration and cached, falling back to number-only automatically. The display is a kiosk web app (Fully Kiosk PLUS on an Android box, or the reception PC on an HDMI-extended TV) with a serialised audio queue, visual flash, and acknowledgements back to the receptionist.

### Cited Findings
- Vendor precedent for TTS-generated-then-played-on-Android-display and for secondary-language announcements — [Qmatic](https://www.qmatic.com/products/voice-announcements)
- Ar-SY and tr-TR neural voices exist on Azure — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts); [Microsoft Tech Community](https://techcommunity.microsoft.com/t5/azure-ai/azure-neural-text-to-speech-updates-51-new-voices-added-to-the/ba-p/1988418)
- Cloud TTS costs are $4–30 per 1M characters (Google/Polly/Azure) — [Google pricing](https://cloud.google.com/text-to-speech/pricing?hl=he); [AWS Polly pricing](https://aws.amazon.com/polly/pricing/)
- Azure/AWS access from inside Syria remains restricted while Google is reopening — [Levant24](https://levant24.com/en/article/microsoft-store-returns-to-syria-amid-digital-restrictions); [UnblockSyria](https://unblocksyria.com/en/services/aws); [Anadolu](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- Autoplay needs a gesture or kiosk policy — [Chrome](https://developer.chrome.com/blog/autoplay)
- Fully Kiosk provides autoplay, keep-awake, autostart and auto-reload — [Fully Kiosk](https://www.fully-kiosk.com/docs/en/features/all)
- Wake Lock must be re-acquired on visibility change — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- Privacy guidance favours numbers, first names or aliases — [Health PEI](https://src.healthpei.ca/sites/src.healthpei.ca/files/ATIP/Waiting_Room_Call-out_Guidance.pdf); [HHS](https://www.hhs.gov/hipaa/for-professionals/faq/may-health-care-providers-use-sign-in-sheets/index.html)
- SILMA TTS (Apache-2.0) is a self-hosted fallback generator — [SILMA](https://huggingface.co/silma-ai/silma-tts)

### Inferences
**A. Announcement content (defaults)**
- Number mode (default): `[chime ~1 s] + "الرقم {N}" + "إلى {room label}"`. The room label is a neutral "العيادة ٢ / الغرفة ٢". "عيادة الدكتور {X}" is a clinic setting.
- Name mode (clinic opt-in, per-patient opt-out, first name or alias only): `[chime] + "{first name}" + "الرقم {N}" + "إلى {room}"`. The number is always present so the announcement degrades gracefully when the name clip is missing.
- Azaz dual mode: the Arabic sequence, then a 0.6 s pause, then the Turkish sequence (`"{N} numara, {oda}"`), wording reviewed by a native speaker.
- Repeat: once by default, configurable to twice. Recall replays the identical clip sequence.

**B. Audio generation pipeline (server side, outside Syria)**
1. Voice packs: generated once per language and voice. Azure ar-SY-LaithNeural (male) or AmanyNeural (female), with Google Chirp 3 HD ar-XA as backup and tr-TR-AhmetNeural/EmelNeural for Turkish.
   - Contents: chime, "الرقم" + numbers 1–999 as full-phrase clips, connectors, letters if prefixes are used.
   - Format: Opus/MP3 at ~32 kbps, versioned (`pack_v{n}.zip` or individual files plus a manifest with hashes).
   - Each audio file is listened to and QA'd once by a native speaker; numbers are fixed by text normalisation before TTS, with no runtime grammar.
2. Tenant phrases (room/doctor names): generated when the clinic configures rooms. They pass through a tashkeel preview step and are added to that tenant's pack.
3. Name clips (optional): generated when the patient is registered or booked, not at call time. The pipeline is the lexicon → CATT/LLM tashkeel → TTS → global cache keyed by hash (shared across tenants) → pushed or prefetched to the clinic's displays as soon as the patient joins today's queue.
4. Vendor abstraction: a `TtsProvider` interface (Azure, Google, SILMA-self-hosted), so a provider or access change only triggers regeneration. Clinics never call TTS vendors directly.

**C. Display client (waiting-room TV)**
- Kiosk PWA served over HTTPS:
  - A Service Worker with Cache Storage/IndexedDB holds the full voice pack plus today's name clips. The manifest diff is checked on each connection.
  - Web Audio playback: decode once, schedule clips back-to-back for gapless joins.
- Activation:
  - With Fully Kiosk PLUS (autoplay on, keep-awake, autostart, auto-reload on reconnect), activation is automatic.
  - In plain Chrome: a one-time "اضغط لتفعيل الصوت" button that resumes the AudioContext, or the AutoplayAllowlist policy on managed devices.
  - Wake Lock is re-acquired on visibilitychange.
- Transport:
  - SSE or WebSocket to the cloud, with heartbeat every 15–30 s, exponential backoff and a full state resync on reconnect.
  - Every call carries call_id, zone_id, clip list and timestamp. The display ignores stale calls older than ~60 s and duplicate call_ids, then sends back `played` acks.
- Audio queue:
  - Serialised FIFO with a 1.5 s gap and no overlap.
  - Ducks the page's own background media during announcements.
  - Applies the volume schedule.
- Visual:
  - Full-screen flash of number and room for ~8 s, synchronised with the audio.
  - A permanent "last 5 calls" strip.
  - Arabic RTL layout, large digits.
- Offline behaviour:
  - Number clips always play from cache.
  - If a name clip is missing, number-only is played.
  - If the pack is missing or corrupt, chime + visual is used (optionally Android TTS via Fully if an `ar` local voice exists).
  - If the cloud is unreachable, see "Local mode".

**D. Local mode for internet outages (important for Syria)**
- Tier 1 (single-room clinics, recommended default install): the reception PC drives the TV as a second HDMI screen. The receptionist app and the display window run in the same browser profile and talk via BroadcastChannel, so calls and audio work with zero internet. Cloud sync resumes when the connection returns, with calls logged locally and uploaded later.
- Tier 2 (multi-room/branch): the display stays on the cloud channel. If the clinic is offline, the receptionist sees "the screen is not connected" and falls back to the manual "call by voice" habit.
- A LAN relay (an Android box or Raspberry Pi running a small local server) is a post-MVP option.

**E. Receptionist / doctor UX (MVP)**
- Per-doctor queue cards with: التالي، إعادة النداء، نداء محدد، لم يحضر، إلغاء.
- A display status indicator (online/offline, last heartbeat, last played).
- A "test sound" button.
- A doctor phone page with next/recall for their own room.
- A call log for the day.
- Settings: language mode, repeat count, name mode, room labels, volume schedule.

**F. Hardware bundle to recommend**
- Option 1: HDMI cable from the reception PC to an existing TV. Cost: near zero.
- Option 2: an Android TV box (2 GB RAM, Android 9+) + Fully Kiosk PLUS (~€6–8 one-time) + HDMI audio, or a wired powered speaker.
- Plus a small UPS or power bank for the router and box.
- Avoid Bluetooth speakers and smart-TV built-in browsers for MVP.

**G. Privacy defaults**
- Number-only by default.
- No surnames, no diagnosis or specialty in audio.
- Per-patient "لا تنادِ باسمي" flag.
- Name clips stored as tenant-scoped references to a global name-audio cache, with no patient linkage stored in the cache itself.
- Name clips purged from devices at end of day.

**H. Validation tasks before build**
1. Blind listening test of Azure ar-SY vs Google Chirp 3 HD ar-XA vs SILMA, using 100 Syrian first names and 50 numbers, with 5 clinic receptionists from Aleppo/Azaz.
2. Confirm vendor ToS and export-control position for generating audio for Syrian end users from a non-Syrian account.
3. Native-speaker review of the Turkish template.
4. Test autoplay, Service Worker caching and the wake lock on 2–3 cheap Android TV boxes sold locally.

### Gaps
- Clinic-owner preferences (male vs female voice, MSA vs Levantine phrasing, name vs number) are unvalidated; a field survey is needed.
- Legal review for Syria (local data-protection law) and for TTS vendor terms is not done.
- Actual network/power outage patterns per clinic were not researched; this determines whether Tier-1 local mode should be the default for multi-room clinics too.
