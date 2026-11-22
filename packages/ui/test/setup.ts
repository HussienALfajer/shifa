// Browser tests load the real stylesheet: Tailwind with the token theme and the font faces.
import '../src/styles/tailwind.css';
import { userEvent } from 'vitest/browser';

// The test page is an iframe that has no focus until something in it is pressed, and UI SDK's
// Tooltip ignores focus while the window has none (a person who switched windows), so the first
// keyboard focus of a run opened nothing (slice 0.4-06). Press the page once, as a person who is
// using it has.
await userEvent.click(document.body, { position: { x: 1, y: 1 } });

// The font faces load lazily, on first use. A popup measured while its text swaps from the
// fallback font changes width after it was placed (UI SDK places it again only when a font
// finishes loading), so a geometry check can catch it mid-swap on a cold machine (CI). Load the
// faces the components use before any test, as a page that has shown text once would have them.
await Promise.all(
  [400, 500, 600, 700].flatMap((weight) => [
    document.fonts.load(`${String(weight)} 16px "Shifa Sans Arabic"`, 'عربي'),
    document.fonts.load(`${String(weight)} 16px "Shifa Sans Arabic"`, 'Latin 0123'),
  ]),
);
