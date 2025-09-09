# Limbus Company Tournament Infographics

Browser-based tool to import tournament draft export codes and generate statistics:

- ID pick/ban/presence/win rates
- Pairing synergy analysis
- Counter-pick response and matchup performance
- Pick & ban timing tendencies
- E.G.O ban statistics

## Usage
Open `index.html` in a modern desktop browser (Chrome/Edge/Firefox). Add draft export codes, select winners, then click **Generate Full Report**. Use the stage filters to include/exclude tournament phases.

## Draft Data
Each draft is a base64 JSON export that includes participants, picks, bans, optional second phase picks, E.G.O bans, and action history. You can bulk load existing JSON files via the "Load from DraftCodes Folder" button if organized by stage.

## Local Persistence
Drafts are saved to `localStorage` automatically. Optionally connect a folder (if supported) to export individual JSON files per draft plus an index.

## Building a Shareable (Minified) Version
For casual sharing without exposing development-readable code:
1. Create a `dist/` folder.
2. Copy assets (`index.html`, `style.css`, `uploads/`, `data.js`).
3. Minify `infographic.js` (e.g. with Terser) and reference it in the copied `index.html`.
4. Host `dist` on a static host (GitHub Pages, Netlify, etc.).

## License
All rights reserved. Not for unauthorised redistribution.
