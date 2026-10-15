# Image asset inventory

Every image the app ships, and what it is made from. All artwork is original.

| Asset | Where | Made from |
|---|---|---|
| Favicon / header mark | `public/icon.svg` | `brand/make-icon.py` (writes `brand/icon.svg` too) |
| PWA icons | `public/icon-192.png`, `icon-512.png`, `icon-1024.png` | `brand/icon.svg`, rendered in Chromium |
| PWA maskable icon | `public/icon-maskable-512.png` | `brand/icon-maskable.svg` |
| Social / OG card | `public/og-image.png` (1200×630) | `brand/og-image.html` |
| Desktop icons | `src-tauri/icons/*` (PNGs, `icon.ico`, `icon.icns`) | `npx tauri icon public/icon-1024.png -o src-tauri/icons` |
| README hero | `public/og-image.png` | as above |
| README screenshots | `docs/screenshot-*.png` | taken from the production build |
| Tutorial art | none: lessons draw their own small Sudoku boards | n/a |
| Title font | `src/assets/fonts/bungee-latin-400.woff2` | Bungee, SIL OFL |
