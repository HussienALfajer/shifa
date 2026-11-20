// Browser tests load the real stylesheet: Tailwind with the token theme and the font faces.
import '../src/styles/tailwind.css';

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
