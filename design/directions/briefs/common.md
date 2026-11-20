# Common brief for the four directions

Every direction draws the same product, the same three screens and the same data. Only the design language differs. Read this file, then the direction's own brief.

## Product

Shifa is a clinic platform for Syria (Aleppo, Azaz). Receptionists and doctors use it all day on low-end Windows PCs and 10-inch tablets; patients book from low-end Android phones. Arabic first, right-to-left.

## The seven principles (spec 0.4)

1. Calm first: about 70 % neutral surfaces; colour marks meaning, never decoration. Red is clinical alert only.
2. Glanceable: one primary action per view; status readable in under a second.
3. Dense but readable: two densities; data text never below 14 px; tabular digits in numbers.
4. Keyboard and touch equal: visible focus ring; every target usable on a 10-inch tablet.
5. Arabic first: drawn in RTL; Latin fragments isolated; type scale tuned for Arabic.
6. Honest motion: 240 ms at most, purposeful, off under reduced motion.
7. Locked clinical meaning: status colours are fixed and never rely on colour alone (icon or label too).

## Fixed for all four

- **Palette:** Damascene Jasmine, from `packages/tokens/generated/css/tokens.css` (`--shifa-*`). Light: cream `#FBF8F1` app background, white surfaces, leaf green `#1F6F5C` primary, night green `#134A3D` navigation, gold `#C8A24A` accent (fill or mark only, never text on light), olive ink `#1D2A26` text. Dark: the `night` steps. Status and queue colours are the locked tokens; do not invent hues.
- **Fonts:** IBM Plex Sans Arabic (UI) and Noto Naskh Arabic (long text), from `packages/tokens/fonts/` (WOFF2, embedded in the build). No other family.
- **Icons:** Phosphor, with Healthicons for medical glyphs, inlined as SVG. Mirror only directional icons (arrows, chevrons); never clocks, checkmarks or medical glyphs.
- **No GPU effects:** no blur, no backdrop filter, no large or layered shadows, no gradients that carry meaning.
- **Arabic type:** no letter-spacing, no justification, no italics; line height 1.5 or more for body; Latin fragments (drug names, units, IDs, phone numbers) in `<bdi dir="ltr">`.
- **Focus ring:** 2 px, 2 px offset, at least 3 : 1 against the surface, on every interactive element.
- **Status:** every status is an icon, a word and a colour together.

## Switches on every screen

A small bar outside the design itself sets attributes on `<html>`:

| Attribute | Values | Notes |
|---|---|---|
| `data-theme` | `light` (default), `dark` | Both must be finished, not inverted. |
| `data-density` | `comfortable` (44 px targets), `compact` (32 px rows) | Compact is for pointer devices; the tablet and phone views stay comfortable. |
| `data-digits` | `western` (default), `arabic-indic` | Changes every number on the screen (OD-20). |

## The three screens

### 1. Reception queue — `reception-queue.html` (desktop, 1366 × 768 and up)
Today's queue for one clinic with two doctors. Shows: the patient in the room, the next three, the full list with status (booked, confirmed, arrived, waiting, in room, done, no-show, cancelled), arrival time, wait time, doctor, and the queue number. One primary action: call the next patient. Also: add a walk-in, search, a saved/offline/syncing indicator, the navigation.

### 2. Doctor visit — `doctor-visit.html` (desktop, and a 10-inch tablet layout at 1280 × 800)
One patient's visit. Shows: the patient banner (name, age, sex, file number, allergy alert), the reason for the visit, vital signs, a note being written (long text), a prescription with two drugs (Latin drug names with doses), earlier visits, and one critical alert (drug allergy). One primary action: finish the visit. The tablet layout is used by touch at the chair.

### 3. Patient booking — `patient-booking.html` (phone, 360 × 800)
A patient books a visit: choose the doctor, the day, the time, confirm. Show the "choose a time" step and the confirmation with the queue number, as two states of the same file. Large targets, one decision per step, the clinic's name, address and fee visible before confirming.

## Data (synthetic only)

Names are combinations of the lists in `packages/testing/src/synthetic/names/lists.ts`. Use these people and no others; put each name in an element with `data-person="<full name>"`.

| Role | Name |
|---|---|
| Doctor | د. سامر الخطيب |
| Doctor | د. ريم الحلبي |
| Patient in the room, and the visit screen | فاطمة أحمد النجار |
| Next patients | خالد مصطفى الحداد · مريم يوسف الشامي · عمر حسن أوزتورك |
| Other patients | زينب علي العمر · إبراهيم محمود يلماز · نور خالد الإدلبي · عبد الله حسين الحمصي · هبة عمر الجاسم |
| Booking patient | سارة إبراهيم الأحمد |

The title "د." stays outside the `data-person` value. Clinic: "عيادة الياسمين" (invented). Phone numbers: `+963 9XX XXX XXX` with X shown as written. Drugs: Amoxicillin 500 mg, Paracetamol 500 mg; allergy: Penicillin. Queue numbers 1 to 24; the patient in the room is number 7.

## Export

Static HTML, CSS and JS with every asset inside the build; no URL to any other host anywhere in the files. Entry files named as above, each with `<html lang="ar" dir="rtl">`.
