# Moonlit kingdom UI review

UI-only changes on `ui/moonlit-kingdom`. No economy, simulation, save-schema or progression changes.

- Persistent drawer navigation connects Build, People, Adventure, Stores and Friends.
- Building cards precede village statistics; short portrait screens use a taller sheet.
- Settings expose visual and accessible toggle states.
- Research cards distinguish ready, active, completed and unavailable technologies.
- People search provides an empty state; Friends inputs wrap within narrow menus.
- Original inline SVG dock icons and navy, gold and parchment styling unify the interface.

## Checked locally

- 474 Node tests pass; static production build succeeds.
- Existing browser gameplay suite passes: placement, collection, touch walls, equipment, training, missions, raids, save/reload, updates, portrait and landscape, with no console errors.
- Targeted real-click checks pass for drawer navigation, expanded states, empty search, Friends inputs, research and settings toggles.
- Screenshot layouts inspected at 320×568, 390×844, 844×390 and 1440×900, with no document horizontal overflow.
- Screenshots use Chromium emulation; physical iPhone/Safari has not been tested.

The preview PNGs show the actual local game. Changes have not been published or deployed.
