# Direction D — Courtyard (أرض الديار)

Read [common.md](common.md) first. This is the session's own direction, asked for by the owner on 2026-11-20.

## Idea
A Damascene or Aleppine house has a quiet, narrow entrance that opens onto a lit courtyard with a fountain at its centre. Every screen works the same way: one lit surface holds "now" (the patient in the room, the current step), and everything else recedes into calm cream arcades. A doctor or receptionist knows where to look in under a second, and the product looks like it comes from here.

## Five signatures
1. **The day thread (خيط اليوم).** A thin vertical line at the start edge of the queue; each visit is a knot on it, in time order. One gold mark shows "now". When the next patient is called the thread advances one step: the only signature motion in the system.
2. **Ablaq (الأبلق).** The alternating light and dark stone courses of Levantine masonry become the table rows: cream-50 and white bands, with a hairline only under the header. It is ornament that does a job (the eye follows a row).
3. **The arch (القوس).** Only the focal card has larger top corners (20 px), like an iwan arch; so does the top of the phone's bottom sheet. Everything else has ordinary corners.
4. **Two voices.** Noto Naskh Arabic is the human voice: the patient's name on the focal card, the text of the doctor's note, the greeting on the booking screen. IBM Plex Sans Arabic is the system's voice: tables, buttons, labels, numbers. Naskh never below 18 px.
5. **The eight-point star (النجمة الثمانية).** From Damascene inlay; the only ornament. It is the "now" mark on the thread, the loading mark, and a watermark at about 4 % in empty states. Never in a work table, never repeated as a pattern behind text.

## Values
| Item | Value |
|---|---|
| Radius | 6 (inputs, buttons, chips) / 10 (cards) / 16 (dialogs, sheets); focal card 20 on the top corners, 10 on the bottom |
| Surfaces | border-first. The focal card is white with a 1.5 px leaf-green outline and no shadow; other cards are white with a cream-300 border; side areas are cream-200. One shadow level, for popovers and dialogs |
| Type | ratio 1.2; data 14/22 (Plex); body 16/26; headings 19, 23, 28 (Plex 600); Naskh 18/30, 22/34 and 28/40 for the human voice; weights 400, 500, 600 |
| Tables | ablaq bands, no row lines; compact 32 px, comfortable 44 px; the current row carries the gold star at the start edge |
| Icons | Phosphor regular at 20 px (1.5 px stroke); duotone with a mint second tone only on the focal card and in empty states |
| Motion | 100 ms hover and press, 160 ms popovers, 220 ms panels, dialogs and the thread step; ease-out in, faster out. Under reduced motion the thread step is a 100 ms cross-fade |
| Status | a seal: icon, word, and a 2 px bar in the status colour at the start edge of the chip |
| Numerals | queue number 40 px, Plex 600, tabular; the current one sits inside a star outline |

## Screens
- **Reception queue.** The thread runs down the start edge; done visits are faded knots above, waiting ones below. The focal card (patient in the room: Naskh name, number in the star, doctor, time in the room) sits at the top of the content, arch-topped, with the primary action "نادِ التالي" beside it. The full list below is an ablaq table.
- **Doctor visit.** The patient banner is the focal card across the top (Naskh name, allergy seal in crimson with icon and word). The note is a white "page" in Naskh at 18/30 with a wide margin; prescription and history are quiet side panels in Plex. On the tablet the side panels become tabs under the page.
- **Patient booking.** A greeting in Naskh, then steps named in words (الطبيب، اليوم، الوقت، التأكيد) as a short horizontal thread with the star on the current step. The time list is large chips; the confirmation is an arch-topped sheet with the queue number inside the star and the clinic's address and fee.
- **Dark ("ليل الدار").** Night-green surfaces; the focal card is the raised surface with a gold hairline, like a lantern in the courtyard. Ablaq bands are night-900 and night-800.

## Risks to watch
- Naskh on Windows at small sizes is weak: hold the 18 px floor, and never use it for data.
- The arch needs its own radius token; keep it to the focal card and the sheet so it stays a signature.
- Status seals on ablaq bands must keep their contrast on both band colours, in light and dark.
- The thread must not push the table: 24 px wide at most, and hidden in compact if the width is under 1280 px.
