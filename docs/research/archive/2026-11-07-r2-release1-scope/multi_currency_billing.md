# Multi-Currency Cash Billing for Syrian Clinics (SYP new / TRY / USD) — research notes, as of 7 Nov 2026

Scope: currency facts for Aleppo and Azaz, how other cash economies handled several currencies at the till, ERP/POS data-model patterns, rate management, the mixed-currency payment flow, cash drawers, reporting, receipts, and a recommended MVP design (last section).
Notation: "SYP" here always means the **new** Syrian pound (1 new = 100 old). Rates are written as "units of currency X per 1 USD" unless stated otherwise.

---

## 1. Syrian currency facts (as of Nov 2026): denominations, old notes, official vs market rates, how Aleppo and Azaz price

### Takeaway
The new SYP (in circulation since 1 Jan 2026) has six banknotes, **10, 25, 50, 100, 200 and 500 SYP**. There is no 5-pound note, and no source mentions coins. That makes **10 SYP (~USD 0.07 at Nov 2026 market rates) the smallest legal cash unit**, and small notes are scarce. Old notes stopped being legal tender on 31 Jul 2026. The Central Bank of Syria (CBS) official rate is held near **122 SYP/USD** (bulletin of 1 Nov 2026), while the street rate is materially higher: ~132 in Sept 2026, and ~145 on 7 Nov 2026 by my reading of an unlabelled live table. In Azaz and the northern Aleppo countryside the TRY is still widely used in Oct 2026, even though the area has been under Damascus administration since early 2026. Merchants re-price within the day when rates move.

### Cited Findings
**Redenomination and notes**
- 100 old pounds = 1 new pound. The new currency entered circulation on 1 Jan 2026 — [Wego Rahhal](https://rahhal.wego.com/blog/%D8%B9%D9%85%D9%84%D8%A9-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D8%A7%D9%84%D8%AC%D8%AF%D9%8A%D8%AF%D8%A9-%D9%84%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%B1%D9%8A%D9%86/); [Al Jazeera, 5 Jan 2026](https://www.aljazeera.com/economy/2026/1/5/syrias-new-currency-removes-al-assad-family-images-seeks-to-boost-economy).
- Denominations are **10, 25, 50, 100, 200 and 500 new SYP**, per the [MRI guide](https://mriguide.com/syria-new-redenominated-banknotes-unveiled/). The 25, 50 and 500 notes are confirmed by [Banknote News 25](https://banknotenews.com/?p=49140), [50](https://banknotenews.com/?p=49145) and [500](https://banknotenews.com/?p=49157). **Conflict:** an early IntelliNews report listed 5, 10, 25, 50, 100 and 500 ([IntelliNews](https://www.intellinews.com/syria-strips-two-zeros-off-currency-as-citizens-face-90-day-deadline-to-swap-old-pounds-417967/)). Arab News (30 Jul 2026, citing Enab Baladi) reports that "the new series does not include a five-pound note" ([Arab News PK](https://www.arabnews.pk/node/2652830)). That supports the 10–500 set.
- The notes carry no portraits or symbols. They were printed by Goznak (Russia) — [Enab Baladi (AR)](https://www.enabbaladi.net/777590/المركزي-ست-فئات-للعملة-الجديدة-دون-صو/).
- **Small-note shortage:** shortages of the new 10, 25 and 50 SYP notes were reported in July 2026 ([Arab News PK, 30 Jul 2026](https://www.arabnews.pk/node/2652830)). In Aug 2026 Enab Baladi English ran the headline "Syrians Use Old 500-Pound Notes, Gum and Bandages". It reported the old blue 500 note (= 5 new SYP) circulating next to the new 25 note even though old notes were banned ([Enab Baladi EN, Aug 2026](https://english.enabbaladi.net/archives/2026/08/syrians-use-old-500-pound-notes-gum-and-bandages/); the page returned 403 to my fetch, so this comes from the search summary).
- **Old notes:** they lost legal tender status on 30 Jul 2026 and were invalid from 31 Jul 2026. A **5-year withdrawal period** handled only by the CBS started 31 Jul 2026, with a minimum of 100 banknotes per application. About 80% of the old currency had been exchanged by end-July — [Arab News PK, 30 Jul 2026](https://www.arabnews.pk/node/2652830); [Enab Baladi EN, Jul 2026](https://english.enabbaladi.net/archives/2026/07/syrian-central-bank-ends-debate-old-pound-invalid-after-july/). A final fee-free exchange week ran through 6 Aug 2026 ([search summary of Enab Baladi EN, Jun 2026](https://english.enabbaladi.net/archives/2026/06/central-bank-extends-syrian-currency-exchange/)).
- **ISO code:** I found no evidence of an ISO 4217 amendment. SYP is still listed as code SYP, numeric 760, with 2 minor-unit digits ([Wikipedia ISO 4217](https://en.wikipedia.org/wiki/ISO_4217); [Wikipedia mirror, Mar 2026](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/SYP)).

**Official CBS rates**
- CBS official bulletin no. 204, 1 Nov 2026 (new SYP per unit):
  - USD 121.50 buy / 122.50 sell (mid 122.00)
  - EUR 135.47 / 136.83
  - **TRY 2.43 / 2.46** (mid 2.445)
  - Bulletin 203 (29 Oct 2026): TRY 2.44 / 2.46.

  Each bulletin **takes effect at 12:30** and stays valid "until further notice", with a **2% price-movement margin**. Bulletin numbers skip days (198 on 22 Oct, 201 on 27 Oct), so bulletins are not strictly daily. The CBS publishes them on Telegram (t.me/SyCBOS) — [Verify-Sy, 1 Nov 2026](https://www.verify-sy.com/ar/topic/economy/newsroom/exchange-rates-in-syria-01NOV).
- The CBS uses one unified daily "official bulletin" with buy, sell and mid rates, described as a rate that can change — [search summary of Al-Ain / Al Jazeera coverage](https://al-ain.com/article/central-bank-syria-raising-syrian-lira-9-bulletins). The official USD rate moved between 118.5 and 122.5 in June 2026 (e.g., 121.50/122.50 on 29 Jun 2026) — [Al-Ain, 29 Jun 2026](https://al-ain.com/article/dollar-price-today-syria-monday-june-29-2026).

**Market rates**
- Market rate on 12 Sep 2026: USD **131.80 buy / 132.20 sell**, identical in Damascus, Aleppo and Idlib (Hasakah 131.50/132.00). TRY/SYP was 2.72/2.74 (Damascus), USD/TRY 48.52. The CBS rate the same week was 122.00 — [Syria TV, 12 Sep 2026](https://www.syria.tv/%D8%B3%D8%B9%D8%B1-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D8%A9-%D9%88%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%85%D9%82%D8%A7%D8%A8%D9%84-%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1-%D9%81%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D9%8A%D9%88%D9%85-%D8%A7%D9%84%D8%B3%D8%A8%D8%AA-12-09-2026).
- Syria TV's live rates page, dated 7 Nov 2026 and the same for Damascus, Aleppo and Idlib, showed:
  - USD **14,450 buy / 14,525 sell**
  - TRY **286 / 290**
  - EUR 15,980 / 16,200

  The page does **not say whether these are old or new pounds**. The magnitudes only make sense as old-pound units (= 144.50/145.25 and 2.86/2.90 new SYP) — [Syria TV live](https://www.syria.tv/%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%B5%D8%B1%D9%81-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D9%85%D9%82%D8%A7%D8%A8%D9%84-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%AA%D8%AD%D8%AF%D9%8A%D8%AB-%D9%85%D8%A8%D8%A7%D8%B4%D8%B1). A search summary also gave Aleppo TRY 285 buy / 288 sell on 7 Nov 2026, again without a stated scale.
- Other aggregators disagree: TRY = 2.84 new SYP on 28 Oct 2026 ([Syfatora](https://syfatora.com/currency)) and 2.78 on 18 Sep 2026 ([Lirtna](https://lirtna.com/currency/turkish-lira)).
- USD/TRY was ~47.4–47.8 in early Aug 2026 ([egcurrency](https://egcurrency.com/ar/country/TR); [FXNewsToday](https://www.fxnewstoday.ae/forex/usd-try)). An analyst forecast 49–51.4 by end-2026, with the lira depreciating ~1–2% per month (forecast, not fact) — [Naga](https://naga.com/ar/news-and-analysis/articles/tahlel-w-twakoat-allera-altrukyeh).

**Azaz and northern Aleppo context**
- The Turkish-controlled areas of northern Aleppo were transferred to the transitional government in Feb 2025, and the Afrin district in Sep 2025. "By January 2026" all formerly occupied areas were under its administration — [Wikipedia](https://en.wikipedia.org/wiki/Turkish_occupation_of_northern_Syria).
- History: in 2020 Azaz authorities forced a switch to TRY. Turkish post offices injected small TRY denominations (Jun 2020), and Azaz supply directorate gave wholesale-market traders 10 days from 7 Sep 2020 to trade in TRY — [Enab Baladi 2020](https://www.enabbaladi.net/391781/?amp=1); [Enab Baladi 416792](https://www.enabbaladi.net/416792/تموين-اعزاز-تلزم-الأهالي-ببدء-التعام/).
- **Current TRY persistence (29 Oct 2026):**
  - TRY has returned as a main currency in Idlib and the Aleppo countryside despite a Dec 2025 SYP-only directive. Bakeries, transport and some traders accept TRY again, and money changers returned to it for higher profit.
  - Reasons given: habit, the exchange-rate gap, **scarcity of small change (الفكة) and inconsistent SYP pricing**, saving in TRY, ties to Turkey, weak e-payments, and some workers paid in TRY by Turkish companies.
  - Example: the Idlib–Aleppo bus fare is ~100 TRY (≈$2) or ~300 SYP (≈$2.3).

  Source: [Syria TV, 29 Oct 2026](https://www.syria.tv/%D8%AA%D8%B9%D8%AF%D8%AF-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D9%84%D9%85%D8%A7%D8%B0%D8%A7-%D8%A7%D8%B3%D8%AA%D8%B9%D8%B5%D9%89-%D8%A5%D8%AE%D8%B1%D8%A7%D8%AC-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%85%D9%86-%D8%B4%D9%85%D8%A7%D9%84-%D8%BA%D8%B1%D8%A8%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7%D8%9F).
- A CBS branch reopened in Idlib on 1 Jul 2026 and announced a "gradual" withdrawal of TRY, with no new TRY injections agreed with Turkey. No dates were given, and Azaz, al-Bab and Afrin were not mentioned — [Al-Modon, 1 Jul 2026](https://www.almodon.com/economy/2026/07/01/%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D8%AA%D8%A8%D8%AF%D8%A3-%D8%B3%D8%AD%D8%A8-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%85%D9%86-%D8%A5%D8%AF%D9%84%D8%A8-%D8%AA%D8%AF%D8%B1%D9%8A%D8%AC%D9%8A%D8%A7); [Al Jazeera, 2 Jul 2026](https://www.aljazeera.net/news/2026/7/2/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2%D9%8A-%D9%8A%D8%B9%D8%B2%D8%B2-%D8%AD%D8%B6%D9%88%D8%B1-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D8%A9-%D9%81%D9%8A). Northern merchants expect that moving off TRY "may take more than a year". Municipalities have asked merchants to price in SYP first — [Economist-SY, 11 Jul 2026](https://economist-sy.com/2026/07/11/%D9%85%D8%A7-%D8%A3%D8%B3%D8%A8%D8%A7%D8%A8-%D8%AA%D8%A3%D8%AE%D8%B1-%D8%A7%D8%B3%D8%AA%D8%A8%D8%AF%D8%A7%D9%84-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A9-%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%81/).
- The CBS said (5 Jan 2026) that the note replacement "does not target the Turkish lira at this stage", and that TRY withdrawal is a separate process — [Aleqt](https://www.aleqt.com/الأخبار/المركزي-السوري-استبدال-العملة-لا-يرتبط-بالدولار-ولا-يستهدف-الليرة-التركية-حاليا-5390).

**How businesses price and update rates**
- "Economy with four currencies" (Al-Modon, 23 Jun 2026, Idlib):
  - Goods may be **priced in USD, paid in SYP, and costed in TRY**. Buyers ask "in which currency?" before "how much?".
  - USD is used for rent, property, savings and supplier payments. TRY is used for daily purchases.
  - A food merchant buys in the morning at one rate and **re-prices in the evening**. Consumers check an exchange-rate app before buying.
  - Idlib governorate requires exchange offices to show rates on clear screens.

  Source: [Al-Modon](https://www.almodon.com/economy/2026/06/23/%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF-%D8%A8%D8%A3%D8%B1%D8%A8%D8%B9-%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D9%88%D9%86-%D9%8A%D8%AD%D8%AA%D8%B3%D8%A8%D9%88%D9%86-%D8%A7%D9%84%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A8%D8%A7%D9%84%D8%A2%D9%84%D8%A9-%D8%A7%D9%84%D8%AD%D8%A7%D8%B3%D8%A8%D8%A9).
- A money changer in al-Bab said that in the Aleppo countryside "people used the Turkish lira no matter how much it lost its value" — [Syria Direct, 21 Oct 2025](https://syriadirect.org/deleting-zeros-will-syrias-new-currency-lighten-the-load-or-add-confusion/).
- Turkish banknotes in circulation are **5, 10, 20, 50, 100 and 200 TL** (E9 series). The TCMB page does not list coins or 500/1000 TL notes — [TCMB](https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Banknotes/Banknotes+in+Circulation+and+Their+Security+Features).

### Inferences
- The official-vs-market gap is ~8% in Sep 2026 (132 vs 122) and ~19% on 7 Nov 2026, if my old-pound reading of the 14,525 figure is right. A clinic that converts at the CBS official rate loses that margin on every SYP payment, so the default must be a **clinic-set market rate**. The CBS rate should be shown as reference only.
- **Rate scale ambiguity is a real data-entry hazard.** Popular rate sites still publish numbers like 14,525 (USD) or 290 (TRY), which look like old-pound units. Any rate input must validate magnitude: detect ×100 errors against the last rate and against sanity bands.
- Cash rounding defaults: **SYP 10** (smallest note; 25 and 50 are also scarce, so allow a clinic to choose 50); **TRY 1 or 5** (5 TL is the smallest note; coin availability in the north is unsourced); **USD 1** (practice assumption, see Gaps).
- Clinics in Azaz will likely see TRY as the main till currency, USD for large dental and orthopaedic treatments, and SYP growing. Aleppo city will lean more on SYP and USD. All three currencies need **first-class support**, not one "foreign" currency.
- Rates move within a day (merchants re-price morning and evening; CBS bulletins take effect at 12:30). The model must allow **several rate versions per day with an effective timestamp**, not one rate per date.

### Gaps
- No source confirms whether new SYP **coins** exist. None was found, so I assume there are none.
- No source gives clinic, pharmacy or doctor pricing practice in Azaz or Aleppo in 2026. The idea that dental and orthopaedic services are priced in USD is an inference from import-cost logic and general dollarization, not a sourced fact.
- I could not access sp-today directly, and found no source on how often it updates. No official API from the CBS or market sites was found (the CBS uses Telegram).
- TRY coin use in northern Syria and USD small-note availability are not sourced.
- Whether Syria qualifies as hyperinflationary under IAS 29 was not researched.

---

## 2. Lessons from Lebanon, Zimbabwe (and Turkey/Iraq)

### Takeaway
Lebanon (2023) shows the operating pattern clinics will meet: **prices in USD, payment in either currency, the store's own rate posted at the register and printed on the receipt, and change given in the weaker currency at a rate the merchant sets**. That rate was often unfavourable and caused disputes. Lebanese hospitals billed partly in "fresh" dollars and partly in lira. Zimbabwe shows what happens when small change runs out: goods or coupons replace change, and prices get rounded up.

### Cited Findings
- **Lebanon supermarkets (from Mar 2023):**
  - Imported goods were priced in USD and local products in lira.
  - The store's **USD-to-lira rate had to be shown at entrances, cash registers and on receipts**.
  - Lira payers were billed at the displayed rate. **Dollar payers could get change in either currency**.
  - Shoppers reported that merchants tended to give change in lira at rates they set themselves. Stores had to update the display when the rate moved during the day.
  - The Economy Ministry still called this rate "unofficial".

  Sources: [L'Orient Today – supermarkets may display USD prices](https://today.lorientlejour.com/article/1328525/supermarkets-will-be-able-to-display-prices-in-us-dollars-economy-minister-announces.html); [L'Orient Today – should you pay in dollars or lira](https://today.lorientlejour.com/article/1334524/should-you-pay-in-dollars-or-in-lebanese-lira.html); [Asharq Al-Awsat](https://english.aawsat.com/home/article/4186911/lebanese-supermarkets-mark-prices-dollars-local-currency-tanks?page=4). These come from search snippets; L'Orient returned 403 to direct fetch.
- **Lebanon health sector (2020–2023):**
  - Some hospitals billed partly in fresh USD and partly in lira at the black-market rate — [The New Arab](https://www.newarab.com/features/lebanons-medical-sector-buckles-under-continuous-crises).
  - Private hospitals adopted parallel-rate billing and **reversed it the same day** — [L'Orient Today](https://today.lorientlejour.com/article/1325625/in-the-space-of-a-few-hours-private-hospitals-issue-and-reverse-decision-to-bill-patients-in-cash.html).
  - Insurers paid half of dollar-denominated bills at an intermediate LL3,900 rate and half at the official rate — [L'Orient-Le Jour](https://www.lorientlejour.com/article/1256203/even-for-those-privately-insured-the-cost-of-being-hospitalized-with-covid-19-can-run-to-millions-of-lira.html).
- **Zimbabwe (ZiG, 2024–2026):**
  - Retailers gave buns, chocolate, sweets or pens instead of coins.
  - A US$0.50 item was charged ZiG10 because of the change shortage.
  - Some customers got change in rand or USD instead of ZiG.
  - In 2020 supermarkets issued **coupons/vouchers as US$ change**, which customers often refused.
  - The RBZ launched a new "BiG 5" small-note series on 7 Apr 2026.

  Sources: [AllAfrica, Jun 2024](https://allafrica.com/stories/202406130447.html); [Herald](https://www.heraldonline.co.zw/smaller-zig-denomination-shortage-impacts-smooth-transactions/); [Sunday News 2020 via PressReader](https://www.pressreader.com/zimbabwe/sunday-news-zimbabwe/20201018/281599537980890); [NewsDay](https://www.newsday.co.zw/opinion-analysis/article/200055268/new-zig-notes-ease-change-crisis-but-trust-deficiency-persists).
- **Syria parallel:** in Aug 2026 Syrians used old 500 notes and "gum and bandages" as change — [Enab Baladi EN headline](https://english.enabbaladi.net/archives/2026/08/syrians-use-old-500-pound-notes-gum-and-bandages/).

### Inferences
- Put the **rate in effect on the receipt and on a screen at the cashier**. This mirrors the Lebanese rule and builds patient trust. Make it mandatory in the receipt template.
- Change in the weaker currency at a merchant-set rate is normal but a source of disputes. The system should **separate "receive" and "give" rates** (a visible spread) and record both on the receipt, rather than hide the spread in rounding.
- Replace "gum as change" with a proper **patient credit balance**: residue below the smallest note, or by the patient's choice, goes to the patient's account. A printed credit is better than a coupon.
- Do not hard-code any rule on which currency change must be in. Lebanon allowed either, and Odoo add-ons differ (see §3).

### Gaps
- I found no sourced material on Lebanese POS vendor products (e.g., how specific Lebanese POS software implemented dual-currency tenders), the **Sayrafa** platform, Iraqi multi-currency retail, or Turkey's 2005 TRL→TRY redenomination handling in POS. These were not researched within the call budget.
- I found no 2026 source on current Lebanese clinic billing.

---

## 3. Data-model patterns: ERP/POS and accounting (Odoo, ERPNext, Square, IAS 21, Money)

### Takeaway
Mature systems agree on the pattern:
- one **company (functional/base) currency**;
- every document carries its own **transaction currency and the exchange rate used**, stored on the document;
- a dated **rate table** (manual or fetched);
- automatic **realized exchange-difference** entries at payment;
- a separate **unrealized revaluation** at reporting dates.

Core Odoo POS and Square do **not** support paying one order in several currencies; Odoo needs third-party add-ons. Money should be integer minor units plus an ISO 4217 code. SYP, TRY and USD all have 2 minor-unit digits.

### Cited Findings
- **Odoo 18** — [Odoo multi-currency docs](https://www.odoo.com/documentation/18.0/applications/finance/accounting/get_started/multi_currency.html):
  - The main currency follows the company's country.
  - Rates are entered manually per currency or auto-updated daily, weekly or monthly from a web service.
  - "If a currency is set on a journal, that journal only handles transactions in that currency". Accounts can also have a set currency.
  - Odoo "automatically records exchange differences entries on dedicated accounts, in a dedicated journal" when a payment arrives at a different rate.
- **Odoo cash rounding** is for when "the lowest physical denomination of currency, or the smallest coin, is higher than the minimum unit of account". It sets a precision, a strategy (a separate rounding line posted to a chosen account, or folding the difference into tax) and a method — [Odoo cash rounding](https://www.odoo.com/documentation/18.0/applications/finance/accounting/customer_invoices/cash_rounding.html).
- **Odoo POS**: "by default, Odoo does not support multi-currency payments" (from the [Synconics sync_pos_currency listing](https://apps.odoo.com/apps/modules/18.0/sync_pos_currency), which adds a popup to split a payment across currencies). Third-party modules handle change differently:
  - [pos_nm_multicurrencies](https://apps.odoo.com/apps/modules/18.0/pos_nm_multicurrencies) computes change in the currency the customer handed over, with a separate change block on the receipt.
  - [ECOSIRE POS Multi-Currency](https://ecosire.com/apps/odoo/pos-multi-currency-payments) always gives change in the base currency, converting each tender at a rate you set.
  - These are vendor marketing pages, not verified behaviour.
- **ERPNext** — [Frappe docs](https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting):
  - The company currency is the base for statements.
  - **Each invoice or payment carries its own Exchange Rate** to the company currency, e.g., EUR 1,200 @1.15 → USD 1,380.
  - Approved manual rates live in the "Currency Exchange" doctype, with a provider fallback and stale-rate settings.
  - A Payment Entry computes a **realized exchange gain/loss** when the payment rate differs from the invoice rate.
  - "Exchange Rate Revaluation" handles **unrealized** differences on open balances. It changes only the company-currency value, not the foreign amount.
  - **One account = one currency**, and account currency is locked once entries exist.
- **Square** — [Square help](https://square.com/help/us/en/article/5415): "the ability to charge your customers in different currencies… is not available". Account country dictates currency, and the merchant workaround is to convert foreign cash manually and key in USD — [Square community](https://community.squareup.com/t5/Using-Square/USD-transactions-in-Canada/td-p/8179).
- **IAS 21:**
  - Functional currency is "the currency of the primary economic environment in which the entity operates". An entity may present statements in any currency — [IFRS.org](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/).
  - Transactions are initially recorded at the **spot rate on the transaction date**. An average rate is allowed if rates do not fluctuate significantly.
  - Monetary items are retranslated at the **closing rate**. Non-monetary items at cost stay at the historical rate.
  - Exchange differences on monetary items go to **profit or loss**.

  Sources for these rules: [ACCA](https://accaglobal.com/an/en/member/discover/cpd-articles/corporate-reporting/ias21-exchange.html); [BDO](https://bdo.com.au/en-au/blogs/corporate-reporting/accounting-for-foreign-exchange-transactions-in-a-non-hyperinflationary-economy); [IFRS Community](https://ifrscommunity.com/knowledge-base/ias-21-effects-of-changes-in-foreign-exchange-rates/). These are secondary summaries.
- **Fowler's Money pattern**: "money isn't actually a first class data type in any mainstream programming language". Mixing currencies and rounding to the smallest unit can quietly lose amounts, so encapsulate both in a Money class — [martinfowler.com](https://martinfowler.com/eaaCatalog/money.html).
- **ISO 4217** — [Wikipedia ISO 4217](https://en.wikipedia.org/wiki/ISO_4217):
  - SYP 760, 2 decimals
  - TRY 949, 2 decimals
  - USD 840, 2 decimals
  - (LBP 422, 2 decimals; IQD 368, 3 decimals)

### Inferences
- Store money as `BIGINT amount_minor` plus `CHAR(3) currency`, never floats. Store rates as `NUMERIC(20,10)` or as an integer numerator/denominator. Convert with decimal arithmetic at full precision, and **round only once, at the final cash amount**.
- Keep two notions of precision per currency:
  - **accounting precision** = ISO minor unit (0.01);
  - **cash precision** = the clinic's cash-rounding unit (SYP 10.00; TRY 1.00 or 5.00; USD 1.00). This is Odoo's cash-rounding concept, applied per currency per tender.
- Choose **USD as the default base (reporting) currency** for a clinic. The CBS rate is administered and lags the market, and SYP lost ~19% against the market in about two months in 2026. Make the base configurable per tenant and **immutable after the first posted transaction** (ERPNext-style account-currency lock). Statutory SYP books, if needed later, can be derived because every transaction stores its rates.
- If an invoice is denominated in its pricing currency (usually USD) and the base is USD, payments in TRY or SYP reduce the USD receivable at payment-time rates. **No realized FX difference arises** in that case, which keeps the MVP simple. Realized FX (invoice-time vs payment-time base equivalent) only appears when invoice currency ≠ base currency.
- Cash held in SYP or TRY loses value against the USD base over time. That is an unrealized FX effect to report later (ERPNext revaluation pattern), not something the MVP must post.
- No ISO code change for the new SYP means the code alone cannot tell old and new values apart. Any legacy or imported SYP amount needs an explicit scale flag, or must be converted ÷100 at import.

### Gaps
- No primary Odoo or ERPNext doc fetched on POS session cash control (opening/closing counts, difference accounts). The cash-drawer design in §6 rests on reasoning and general practice, not on a cited vendor spec.
- Lightspeed multi-currency was not researched.

---

## 4. Exchange-rate management UX

### Takeaway
Clinics should set their own rates, several times a day if needed, with an effective timestamp, a buy/sell ("receive"/"give") spread, immutable history and permissioned per-transaction overrides. Platform reference rates (CBS official; a market feed) are shown for comparison only and are never applied silently.

### Cited Findings
- CBS bulletins carry buy, sell and mid rates, take effect at 12:30, stay valid "until further notice" with a 2% band, and do not appear every day — [Verify-Sy, 1 Nov 2026](https://www.verify-sy.com/ar/topic/economy/newsroom/exchange-rates-in-syria-01NOV).
- Market rates are quoted as buy/sell pairs per city (e.g., 131.80/132.20 in Aleppo on 12 Sep 2026) — [Syria TV](https://www.syria.tv/%D8%B3%D8%B9%D8%B1-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D8%A9-%D9%88%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%85%D9%82%D8%A7%D8%A8%D9%84-%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1-%D9%81%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-%D9%8A%D9%88%D9%85-%D8%A7%D9%84%D8%B3%D8%A8%D8%AA-12-09-2026).
- Merchants re-price the same day (morning vs evening) — [Al-Modon, 23 Jun 2026](https://www.almodon.com/economy/2026/06/23/%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF-%D8%A8%D8%A3%D8%B1%D8%A8%D8%B9-%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D9%88%D9%86-%D9%8A%D8%AD%D8%AA%D8%B3%D8%A8%D9%88%D9%86-%D8%A7%D9%84%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A8%D8%A7%D9%84%D8%A2%D9%84%D8%A9-%D8%A7%D9%84%D8%AD%D8%A7%D8%B3%D8%A8%D8%A9). Lebanese stores had to update displayed rates on intraday moves — [L'Orient Today](https://today.lorientlejour.com/article/1334524/should-you-pay-in-dollars-or-in-lebanese-lira.html).
- ERPNext keeps approved manual rates in "Currency Exchange", falls back to a provider, and has configurable stale-rate handling — [Frappe docs](https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting). Odoo supports manual rate lines or scheduled auto-fetch — [Odoo docs](https://www.odoo.com/documentation/18.0/applications/finance/accounting/get_started/multi_currency.html).
- Popular rate sites publish unlabelled old-scale figures in Nov 2026 (USD 14,525; TRY 290) — [Syria TV live](https://www.syria.tv/%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%B5%D8%B1%D9%81-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D9%85%D9%82%D8%A7%D8%A8%D9%84-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%AA%D8%AD%D8%AF%D9%8A%D8%AB-%D9%85%D8%A8%D8%A7%D8%B4%D8%B1).

### Inferences
- **Rate record** (per clinic, optionally per branch) holds:
  - `base_currency`, `quote_currency`
  - `receive_rate`: quote units per 1 base, applied when the patient pays in the quote currency. This is the market sell rate of USD (more SYP/TRY per USD).
  - `give_rate`: applied when the clinic pays out the quote currency (change, refund). This is the market buy rate (fewer SYP/TRY per USD).
  - `effective_from`, `source` (manual / CBS / market-feed / override), `created_by`, `note`

  Rates are immutable once used; a new rate = a new row.
- **Rate locking rules:**
  1. The **invoice** stores a rate snapshot, used only to display equivalents and to compute the invoice's base value for reporting. The receivable stays in invoice currency.
  2. Each **payment tender** uses the clinic rate **effective at payment time** and stores it on the tender row.
  3. **Quotes and treatment plans** (dental) may carry an optional "price-guaranteed-until" date. Otherwise they are re-converted at payment time.
- **UX:**
  - A "today's rates" card on the cashier and owner dashboard shows clinic rates next to the CBS official rate and an optional market reference, with the age of each ("updated 3h ago").
  - Show a stale warning when the clinic rate is older than a configurable N hours (default 24), and **block cash payments in a foreign currency** if no rate exists for today and no override is given.
  - Validation: reject or confirm a new rate that differs from the previous one by more than ±10%, and auto-detect ×100/÷100 typos (old-pound scale).
  - **Override per transaction**: requires the `rate.override` permission, a reason and an optional max deviation (e.g., ±3%). Overrides are logged in an audit trail with before/after values.
- Platform reference feed: fetch the CBS bulletin from the CBS Telegram channel or website if feasible. Treat market feeds as informational only, since no official API was found.

### Gaps
- No source was found on what Syrian clinics actually do today (fixed weekly rate vs live rate). User interviews are needed.
- No data was found on typical exchange-shop spreads in Azaz. Syria TV shows about 0.3–0.5% spreads in city quotes.

---

## 5. Mixed-currency payment flow at the cash desk

### Takeaway
Treat a payment as one **receipt with N tender lines (in) and M change lines (out)**, each in its own currency with its rate stored. Compute everything in the invoice currency at full precision. Show the remaining balance in all three currencies live. Round only the cash amount in the chosen change currency to that currency's cash unit, and post the residue to a rounding line or to patient credit.

### Cited Findings
- Lebanese practice: lira payers are billed at the displayed rate; **dollar payers can get change in either currency** — [L'Orient Today](https://today.lorientlejour.com/article/1334524/should-you-pay-in-dollars-or-in-lebanese-lira.html).
- Odoo add-ons implement split multi-currency tenders through a popup ([Synconics](https://apps.odoo.com/apps/modules/18.0/sync_pos_currency)). Change is given either in the tender currency ([pos_nm_multicurrencies](https://apps.odoo.com/apps/modules/18.0/pos_nm_multicurrencies)) or always in the base currency ([ECOSIRE](https://ecosire.com/apps/odoo/pos-multi-currency-payments)).
- Odoo cash rounding posts the difference to a dedicated rounding account line — [Odoo docs](https://www.odoo.com/documentation/18.0/applications/finance/accounting/customer_invoices/cash_rounding.html).
- Smallest SYP note is 10, and 10/25/50 notes are in short supply — [MRI](https://mriguide.com/syria-new-redenominated-banknotes-unveiled/); [Arab News PK](https://www.arabnews.pk/node/2652830).
- Zimbabwe: change shortages lead to rounding up and goods as change — [Herald](https://www.heraldonline.co.zw/smaller-zig-denomination-shortage-impacts-smooth-transactions/).

### Inferences — worked example
Illustrative clinic rates, near the 7 Nov 2026 market; base and invoice currency USD:

| Currency | receive_rate (per USD) | give_rate (per USD) |
|---|---|---|
| SYP | 145.25 | 144.50 |
| TRY | 50.50 | 50.10 |

**1. Overpayment, change in SYP.** A filling costs **USD 30.00**. The patient pays USD 20 + TRY 600.
- TRY 600 / 50.50 = USD 11.881188 (kept at full precision).
- Tendered = USD 31.881188; overpaid = USD 1.881188.
- Change in SYP at give_rate: 1.881188 × 144.50 = 271.83 SYP.
- Rounded to the 10 SYP cash unit: **270 SYP**.
- Residue 1.83 SYP (≈ USD 0.0127) is posted as a rounding line, or the patient chooses "keep as credit": change 0 and credit USD 1.88.

**2. Underpayment.** The patient pays USD 20 + TRY 400.
- TRY 400 = USD 7.920792; remaining = **USD 2.079208**.
- The screen shows the remaining amount live as USD 2.08 / TRY 105 (2.079208 × 50.50 = 105.0) / SYP 302 (× 145.25 = 302.0).
- If the patient settles in SYP, the cash-due figure is rounded to the cash unit: **300 SYP** (nearest, ties in the patient's favour). The 2 SYP difference goes to rounding.
- If the patient leaves, the invoice stays open with a **USD 2.08 balance**.

**Rules**
- **R1:** Tender lines are entered per currency (with quick buttons for common notes). Running totals are computed in invoice currency at full precision.
- **R2:** The change currency is chosen by the cashier from currencies with drawer stock. The default is the clinic setting (e.g., "SYP first"). Change can be split across currencies (e.g., USD 1 + SYP 120).
- **R3:** Round only the final cash amount per currency. The default method is nearest for both change and amount-due, with half-ties going to the patient. Configurable: round change down / round due up. **Rounding residue ≤ ½ cash unit** goes to the rounding account. Anything above that, or by the patient's choice, becomes **patient credit**.
- **R4:** The system warns when the drawer has too little of the selected change currency, using live drawer balances (§6).
- **R5:** Partial payments and installments (dental plans):
  - The receivable stays in **invoice currency** (normally USD), so SYP depreciation does not erode it.
  - Each installment is a separate receipt using that day's rates.
  - A patient statement shows the balance in invoice currency plus today's equivalents.
- **R6:** **Patient credit/deposits** are held in base currency (USD), converted at receive_rate on deposit and stored with the rate. They are applied to later invoices without re-conversion. This avoids per-currency wallets in the MVP.
- **R7:** **Refunds** are a negative receipt in any currency at **give_rate at refund time**, require the `refund` permission and a reason, and are capped at the amount paid in base terms. Default suggestion: refund in the original tender currencies.
- **R8:** **No standalone currency exchange** for patients at the desk in the MVP. A swap is only possible as change on a real invoice, to avoid acting as a money changer (regulators supervise exchange offices).

### Gaps
- No Syrian legal rule was found on which currency change must be given in, or whether pricing in USD or TRY is permitted for clinics (Idlib's SYP-only directive targets institutions). **Regulatory status of USD/TRY pricing for private clinics in Aleppo and Azaz is an open question.** The UI should allow SYP display of prices and SYP-only mode.

---

## 6. Cash drawer / shift management per currency

### Takeaway
One cash session per cashier per drawer per shift. Each session holds **a separate opening float, expected balance, counted balance and difference for each currency**, with cash-in/out movements typed per currency. Differences are never netted across currencies. Each currency's difference is valued in base only for reporting.

### Cited Findings
- ERPNext requires **one account per currency** for cash and bank; a ledger's currency cannot change once used — [Frappe docs](https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting).
- Odoo journals can be restricted to one currency ("that journal only handles transactions in that currency") — [Odoo docs](https://www.odoo.com/documentation/18.0/applications/finance/accounting/get_started/multi_currency.html).
- Odoo POS cash payment methods are bound to a Cash journal — [Odoo POS payment methods](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/payment_methods.html).

### Inferences
- **`cash_session`** holds: branch, drawer, cashier, opened_at/by, closed_at/by, status (open / closing / closed / approved).
- **`cash_session_balance`** holds one row per session and currency:
  - `opening_minor`
  - `expected_minor` = opening + tenders in − change out − refunds out + cash_in − cash_out ± swaps
  - `counted_minor`, with optional denomination breakdown (SYP 500/200/100/50/25/10; TRY 200/100/50/20/10/5 + coins; USD 100/50/20/10/5/1)
  - `difference_minor`
  - `difference_base_minor`, valued at the closing rate for reporting only
- **`cash_movement`** has a type: `sale_tender_in`, `change_out`, `refund_out`, `cash_in` (float top-up), `cash_out` (expense or owner withdrawal), `bank_deposit`, `transfer_to_safe`, `fx_swap_out`/`fx_swap_in` (paired; e.g., the owner sells USD to a money changer for SYP, with the rate recorded). Each movement records currency, amount and reason.
- **Close flow:**
  1. Blind count per currency.
  2. The system reveals the differences.
  3. Above a threshold (e.g., > USD 2 equivalent or any USD note difference), a manager must approve with a note.
  4. A Z-report is printed.
- The **daily close report** shows per branch and per currency: opening, receipts, change, refunds, in/out, expected, counted and difference. It also shows the base-currency total of receipts at the rates actually used, with a reconciliation against invoices settled.
- Multi-branch: rates can be clinic-wide with an optional branch override. Sessions and drawers belong to a branch, and owner dashboards aggregate across branches.

### Gaps
- No sourced vendor documentation was fetched for multi-currency drawer counts (e.g., Odoo POS session closing per currency). This design comes from general accounting practice and needs validation with Syrian clinic cashiers.

---

## 7. Reporting: revenue in a reporting currency, per-currency cash totals, doctor commissions

### Takeaway
Report revenue (invoiced) and collections (cash) in a chosen reporting currency using the **historical rates stored on each transaction**, never today's rate. Keep a parallel "physical cash by currency" view. Compute doctor commissions on base-currency equivalents of collections at payment-time rates, and pay them out in the doctor's chosen currency at the payout-day rate.

### Cited Findings
- IAS 21: transactions are measured at the spot rate on the transaction date (average rate allowed if stable). Monetary balances are retranslated at the closing rate, and differences go to P&L — [ACCA](https://accaglobal.com/an/en/member/discover/cpd-articles/corporate-reporting/ias21-exchange.html); [BDO](https://bdo.com.au/en-au/blogs/corporate-reporting/accounting-for-foreign-exchange-transactions-in-a-non-hyperinflationary-economy).
- ERPNext: realized gain/loss on payment vs invoice rate. Unrealized revaluation changes only the base value of open foreign balances — [Frappe docs](https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting).
- Pricing in SYP vs TRY can give different effective USD prices for the same service (bus fare 100 TRY ≈ $2 vs 300 SYP ≈ $2.3) — [Syria TV, 29 Oct 2026](https://www.syria.tv/%D8%AA%D8%B9%D8%AF%D8%AF-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D9%84%D9%85%D8%A7%D8%B0%D8%A7-%D8%A7%D8%B3%D8%AA%D8%B9%D8%B5%D9%89-%D8%A5%D8%AE%D8%B1%D8%A7%D8%AC-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%85%D9%86-%D8%B4%D9%85%D8%A7%D9%84-%D8%BA%D8%B1%D8%A8%D9%8A-%D8%B3%D9%88%D8%B1%D9%8A%D8%A7%D8%9F).
- Fowler warns that rounding to the smallest unit loses money and that currencies must not be mixed blindly — [Fowler](https://martinfowler.com/eaaCatalog/money.html).

### Inferences
- **Reports in the MVP:**
  1. Revenue (invoiced) by service, doctor and branch, in the reporting currency. Each invoice is converted at its stored snapshot. Reporting currency = base, or any currency via the stored base→X rate on that date.
  2. Collections by tender currency: native amounts plus base equivalents at tender rates.
  3. Cash position by currency (physical).
  4. Rounding and FX lines: total rounding residue; spread income, i.e. the difference between receive/give and mid rates, if mid is stored.
  5. Open receivables (patient balances) in invoice currency, with today's equivalents.
  6. Optional "holding loss/gain" view: SYP/TRY cash valued at today's rate vs at receipt rates (unrealized, informational).
- **Doctor commission:**
  - Base = collections allocated to the doctor's invoice lines, in base currency at the **tender rates** (cash basis), net of refunds. Optionally an invoice basis.
  - Commission % or a fixed fee per service, with lab or material costs deducted first for dental and orthopaedic work.
  - The payout is a cash_out movement in the currency the doctor chooses, converted at the payout-day give_rate and recorded.
  - Use Fowler-style `allocate()` (largest-remainder) when splitting a payment across several invoice lines or doctors, so cents are never lost.
- Never recompute history with current rates. All historical reports read stored rates.

### Gaps
- No Syrian-specific source on how clinics currently pay doctors (fixed USD vs % of SYP takings). This needs owner interviews.

---

## 8. Arabic receipts showing several currencies and the rate

### Takeaway
An Arabic RTL receipt should show: the invoice total in its pricing currency; each tender line in its own currency with the rate applied; the change line in its currency with its rate; the rounding line; the remaining balance or credit; and a footer with the full rates in effect (date and time). The Lebanese rules required the rate on receipts.

### Cited Findings
- Lebanon required the store's dollar/lira rate to be displayed at registers and **on receipts** — [L'Orient Today](https://today.lorientlejour.com/article/1328525/supermarkets-will-be-able-to-display-prices-in-us-dollars-economy-minister-announces.html).
- An Odoo multi-currency POS add-on prints a separate change block in the currency handed back — [pos_nm_multicurrencies](https://apps.odoo.com/apps/modules/18.0/pos_nm_multicurrencies).
- Confusion between old and new SYP was expected during the transition. Merchants told shoppers to "check the price again" — [Syria Direct, 21 Oct 2025](https://syriadirect.org/deleting-zeros-will-syrias-new-currency-lighten-the-load-or-add-confusion/).

### Inferences
- Receipt layout (Arabic, RTL, 80 mm thermal and A4/A5):
  - **Header:** clinic, branch, receipt no., date/time, cashier, patient, doctor.
  - **Lines:** service and price in invoice currency.
  - **"الإجمالي: 30.00 دولار أمريكي"**
  - **Tenders:** "مدفوع نقداً: 20.00 دولار" and "مدفوع نقداً: 600 ليرة تركية (سعر 50.50 ل.ت/دولار = 11.88 دولار)".
  - **Change:** "الباقي المُعاد: 270 ل.س (سعر 144.50 ل.س/دولار)".
  - **Rounding:** "فرق تقريب: 1.83 ل.س".
  - **Status:** "الرصيد المتبقي / رصيد دائن".
  - **Footer:** "أسعار الصرف المعتمدة بتاريخ … الساعة …".
- Use explicit currency labels: "ل.س" for the new pound, with the full name "ليرة سورية (جديدة)" in the footer, plus "ل.ت" and "دولار". This avoids old/new ambiguity.
- Make Western vs Eastern Arabic digits configurable, and keep amounts as LTR runs inside RTL text (Unicode bidi isolation) so "1,234.50" does not render reversed.
- Every receipt needs a unique number. Reprints must be marked "نسخة".

### Gaps
- No source found on Syrian legal requirements for receipt or invoice content (tax/VAT IDs, Arabic mandatory fields) for clinics in 2026.

---

## 9. Recommended MVP design (synthesis)

### Takeaway
Use a single-tenant base currency (default USD, immutable), invoices in their pricing currency, and receipts made of multi-currency tender and change lines with stored per-tender rates. Clinic-managed receive/give rates have timestamps and history. Each currency has its own cash rounding (SYP 10). Cash sessions are tracked per currency. Reports use stored historical rates.

### Cited Findings
- The patterns this design rests on are cited in §§1–8: CBS 122 official vs ~132–145 market in Sep–Nov 2026 ([Verify-Sy](https://www.verify-sy.com/ar/topic/economy/newsroom/exchange-rates-in-syria-01NOV); [Syria TV](https://www.syria.tv/%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%B5%D8%B1%D9%81-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A7%D8%AA-%D9%85%D9%82%D8%A7%D8%A8%D9%84-%D8%A7%D9%84%D9%84%D9%8A%D8%B1%D8%A9-%D8%AA%D8%AD%D8%AF%D9%8A%D8%AB-%D9%85%D8%A8%D8%A7%D8%B4%D8%B1)); the smallest SYP note is 10 ([MRI](https://mriguide.com/syria-new-redenominated-banknotes-unveiled/)); per-transaction rates and realized/unrealized FX ([Frappe](https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting)); cash rounding ([Odoo](https://www.odoo.com/documentation/18.0/applications/finance/accounting/customer_invoices/cash_rounding.html)); rate on receipts ([L'Orient Today](https://today.lorientlejour.com/article/1328525/supermarkets-will-be-able-to-display-prices-in-us-dollars-economy-minister-announces.html)).

### Inferences (the design)

**A. Money and currency primitives**
- `Money { amount_minor: bigint, currency: 'SYP'|'TRY'|'USD' }`. No floats anywhere. Use decimal math with ≥10 dp for conversions.
- `currency_settings(clinic_id, currency, enabled, cash_unit_minor, rounding_mode, display_name_ar, symbol_ar, sort_order)`. Defaults:
  - SYP: cash unit 1000 minor (= 10.00)
  - TRY: 100 minor (1.00)
  - USD: 100 minor (1.00)
  - rounding_mode: nearest, ties to patient
- `clinic.base_currency` (default USD) is locked after the first posting. `report_currency` is selectable at query time.

**B. Exchange rates**
- `exchange_rate(id, clinic_id, branch_id?, base, quote, receive_rate, give_rate, mid_rate?, effective_from, source{manual|cbs_ref|market_ref|override}, created_by, reason?, created_at)`. Append-only; the "current" rate is the latest with effective_from ≤ now.
- `reference_rate(source{CBS, market}, quote, buy, sell, published_at)` is platform-wide and display-only.
- Guards:
  - stale > 24h (configurable) → warning; no rate today → foreign-currency tenders blocked unless overridden;
  - change > ±10% → confirm;
  - ×100 pattern → reject with an "old-pound scale?" hint.
- Overrides need `perm: rate.override`, a mandatory reason and a max deviation, and are written to `audit_log`.

**C. Pricing and invoicing**
- Price list items carry their own currency (a clinic may price consultations in SYP and implants in USD). The UI shows equivalents at the current receive_rate.
- `invoice(id, patient_id, branch_id, doctor_id, currency, total_minor, status, rate_snapshot_json, base_total_minor, created_at)`:
  - **The invoice currency is the price currency**. Mixed-currency line items on one invoice are disallowed in the MVP; lines are converted to the invoice currency at creation using the snapshot.
  - The receivable and balance stay in invoice currency.
  - Treatment plans or quotes have an optional `rate_guaranteed_until`.

**D. Payments (receipts)**
- `receipt(id, invoice_id?, patient_id, cash_session_id, created_by, created_at, total_applied_minor (invoice ccy), rounding_minor, credit_created_minor)`.
- `receipt_line(id, receipt_id, direction{in|out}, kind{tender|change|refund|credit_apply}, currency, amount_minor, rate_used, rate_id, applied_invoice_ccy_minor, base_equiv_minor)`.
- Algorithm:
  1. Sum `in` tenders converted at receive_rate into invoice currency (full precision).
  2. Compute remaining or over.
  3. If over: the cashier picks change currency/currencies; convert at give_rate; round each change line to its cash_unit; the residue goes to `rounding_minor` (≤ ½ unit) or to patient credit (by the patient's choice or if larger).
  4. If under: the invoice stays partially paid; show the remaining amount in all enabled currencies.
- Installments are simply multiple receipts. Patient credit is held in base currency, with the rate stored. Refunds are `out` lines at give_rate, need a permission, and are capped at the amount paid.
- Supported methods in the MVP: cash in three currencies. Optional "bank transfer / ShamCash-type wallet" as a non-cash tender in SYP (out of scope unless needed).

**E. Cash sessions**
- `cash_session`, `cash_session_balance` (per currency: opening, expected, counted, difference, denomination JSON) and `cash_movement` (typed, per currency), as in §6.
- Blind close, manager approval above a threshold, Z-report. No cross-currency netting of differences.
- Change-availability warnings use live expected balances.

**F. Reporting**
- Revenue, collections, cash by currency, receivables, rounding/spread, and doctor commission (cash basis on base equivalents at tender rates; payout in the chosen currency at payout give_rate).
- Every report reads stored rates. Exports to Excel.

**G. Receipts**
- Arabic RTL template with each tender and change line, its currency and rate; a rounding line; balance or credit; and a footer listing the rates in effect with a timestamp. Label "ليرة سورية جديدة". Print rates on every receipt and display them on the cashier screen.

**H. Out of scope for the MVP**
- Full double-entry GL with realized/unrealized FX postings (data is captured so it can be added later).
- IAS 29 hyperinflation restatement.
- Standalone currency exchange at the desk.
- Card or wallet integrations.
- Automatic market-rate scraping (show the CBS reference only if a reliable feed exists).

### Gaps
- Regulatory permissibility of USD/TRY pricing by private clinics in Aleppo city vs Azaz in late 2026. Idlib has an SYP-only directive for institutions, and municipalities ask merchants to price in SYP ([Economist-SY](https://economist-sy.com/2026/07/11/%D9%85%D8%A7-%D8%A3%D8%B3%D8%A8%D8%A7%D8%A8-%D8%AA%D8%A3%D8%AE%D8%B1-%D8%A7%D8%B3%D8%AA%D8%A8%D8%AF%D8%A7%D9%84-%D8%A7%D9%84%D8%B9%D9%85%D9%84%D8%A9-%D8%A7%D9%84%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D9%81/)). **Recommend an "SYP-display mode"** that shows all prices and receipts primarily in SYP, while keeping USD as the internal base.
- Actual clinic practice (who sets rates, how often, change policy, doctor pay) needs 5–10 clinic interviews in Aleppo and Azaz.
- Whether a dependable machine-readable CBS rate feed exists (only a Telegram channel was found).
