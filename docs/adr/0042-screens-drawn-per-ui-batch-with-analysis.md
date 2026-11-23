# ADR-0042: Screens are drawn at the start of each UI batch, after the API, with a full analysis

Status: Accepted (owner, 2026-11-23) · Date: 2026-11-23 · Deciders: product owner (with Claude) · Amends: [ADR-0040](0040-design-first-in-claude-design-code-as-source.md) (when screens are drawn)

## Context
ADR-0040 has `/spec` draw every screen of a feature and the owner approve the screens with the spec. The first Phase A spec (A-01, OD-75) showed the cost: about twenty screens drawn weeks before any of them is built, one large approval, and drawings that age while the API, the design system and the owner's decisions move. Its slices start with tables, permissions and the API anyway, which need no drawing.

The same exercise showed the value of drawing: the drawings exposed needs the API must serve (a pending invitation shown in the clinic chooser, the reason a last owner cannot be demoted). Drawing after the API risks finding such needs late.

## Decision
- **Spec (`/spec`): a screen inventory in words, no drawing.** For a feature with UI the spec lists each screen: its name, purpose, the sizes it needs (desktop, 10-inch tablet, phone), every state (default, loading, empty, error, locked, offline, permission denied…) and the data and actions each state shows. This is enough to build the API correctly. The owner approves the spec without drawings.
- **UI batch slice: draw, analyse, approve, then build.** The API and the rest of a feature are built first. When the plan reaches a batch of screens (for example all sign-in screens), the batch's first checkpoint draws them in the app's screens canvas, as ADR-0040 describes (Shifa Design System installed, its real components, Arabic RTL, light and dark, the sizes needed, synthetic data). A batch may hold several screens; the owner approves them together.
- **The Shifa Design System, used correctly and only it** (OD-80). Every screens canvas installs the system (its `tokens.json`, `tokens.css`, component bundle and fonts, with its `designSystems` record) and every artboard loads them. Components are the system's real ones, mounted from its bundle (`Shifa.Button`, `Shifa.Input`, `Shifa.DataTable`…), never look-alikes. Colours, spacing, radii, shadows, sizes and type come from its tokens (`var(--shifa-…)`) and its type styles (`title-md`, `label-sm`…): no hex value, no own palette, no font of its own, no spacing or radius that is not a token step. Where the system exposes no part for something (an open menu, a drawer holding a custom form), the frame is built from that component's own tokens with real components inside, and the analysis names it as a component gap. Before the drawings are shown, the batch's artboards are checked for literal colours, unknown `--shifa-` names and hand-drawn copies of existing components, and the result is written in the slice file.
- **Drawings are working prototypes the owner tests in Play** (OD-80). Every artboard of a batch is marked interactive. Fields accept typing, buttons and links act, and the batch's flow runs from screen to screen (sign in → TOTP → clinic chooser → home) with the state it needs kept in one artboard. Every state in the inventory (error, locked, empty, loading, offline, permission denied…) is reachable by the action that causes it, or by a clearly labelled state switcher outside the screen frame; light and dark and the sizes needed can be switched in Play. Data stays synthetic, nothing calls a real API. The owner approves after testing the batch in Play.
- **A complete analysis comes with every drawn batch**, written in the slice file and shown to the owner with the drawings:
  1. **API gaps:** every field, state, error or action a screen needs that the built API does not give (a missing field, an error the client cannot tell apart, a list without the sort the screen needs, a permission the screen assumes). Each gap is fixed in the batch slice or in a small slice before it, never worked around in the client.
  2. **Spec gaps:** a state, edge case or message the inventory missed, recorded and added to the spec.
  3. **Professional and creative improvements:** proposals that make the screens clearly better for a busy Syrian clinic (fewer steps or presses, smart defaults, keyboard paths for reception, helpful empty and error states, clear Arabic wording, reassurance on risky actions, offline and slow-network cues, accessibility beyond the minimum, a distinctive but calm touch within the Shifa Guide). Each proposal says what it costs (API, component, time). The owner accepts or declines each one; accepted ones are drawn before approval, declined ones are listed in the slice file.
  4. **Design-system gaps:** a component the system lacks goes through the component cycle first (`/ui-component`), never drawn as a one-off.
- **Approval and evidence stay as in ADR-0040:** nothing in the batch is coded before the owner approves its drawings; the built screen's browser screenshot (real backend) is compared with the approved drawing and every difference is fixed or explained.
- **Drawings made early are drafts.** A drawing made before its batch (such as the A-01 clinic-web screens of 2026-11-23) is reviewed and updated at the batch's checkpoint; it is not an approval.

Everything else in ADR-0040 stands.

## Consequences
+ Each approval is small and close to the code it governs; drawings do not age.
+ The owner judges a working flow, not a picture, and the drawing matches the shipped components and tokens exactly.
+ The analysis turns drawing into a check on the API and the spec, and a regular place for improvements, not decoration.
+ The API is built from a precise screen inventory, so late gaps should be few and small.
− A gap found at drawing time can reopen finished API work (bounded: a small fix slice).
− An interactive batch takes longer to draw than static boards.
− The owner sees the look of a feature later than with ADR-0040.

## Alternatives considered
- Keep ADR-0040 (draw everything in `/spec`): one large early approval; drawings age. Rejected by the owner.
- Draw while building each screen, with no separate approval: the session that writes the code designs and judges its own screen. Rejected.
- Draw the API's needs from the spec text alone, no analysis at drawing time: misses what only a drawing shows. Rejected.
