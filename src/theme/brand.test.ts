import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const style = readFileSync(new URL('../style.css', import.meta.url), 'utf-8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8');
const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8');

describe('brand', () => {
  it('the title font is bundled, never fetched from a CDN, and loads after the token import', () => {
    const face = /@font-face\s*{[^}]*font-family:\s*'Bungee'[^}]*url\('([^']+)'\)/.exec(style);
    expect(face).not.toBeNull();
    expect(face![1]).not.toMatch(/^https?:|^\/\//);
    expect(existsSync(new URL(face![1], new URL('../style.css', import.meta.url)))).toBe(true);
    expect(style).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\./);
    expect(style.indexOf('@import')).toBeLessThan(style.indexOf('@font-face'));
  });
  it('the header title shows no version number', () => {
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)![1];
    expect(h1).toContain('Sudoku Solver');
    expect(h1).not.toMatch(/version|v\d/);
  });
  it('one gear opens Settings, which holds the theme, mode, update check and version', () => {
    const header = /<header>([\s\S]*?)<\/header>/.exec(html)![1];
    expect(header).toContain('id="settings"');
    expect(header).not.toMatch(/id="(theme|check-update)"/);
    const dlg = /<dialog id="settings-dialog"[\s\S]*?<\/dialog>/.exec(html)![0];
    for (const id of ['theme-skins', 'theme-modes', 'check-update', 'version', 'settings-close']) expect(dlg).toContain(`id="${id}"`);
    expect(dlg).toMatch(/<div id="updates-section">\s*<h3>Updates<\/h3>[\s\S]*?id="check-update"[\s\S]*?<\/div>\s*<\/div>/);
    // The web build drops the Updates section; only the desktop app checks.
    expect(main).toMatch(/if \(updatesEnabled\(window\)\)[\s\S]*?\$\('updates-section'\)\.remove\(\)/);
  });
  it('every icon the manifest and page name exists, including the social card', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf-8'));
    expect(manifest.name).toBe('Sudoku Solver');
    for (const i of manifest.icons) expect(existsSync(new URL(`../../public/${i.src}`, import.meta.url))).toBe(true);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    expect(html).not.toContain('og:url');
    expect(html).not.toMatch(/chafic\.me/);
    expect(html).toContain('<meta name="twitter:image" content="./og-image.png" />');
    const og = /property="og:image" content="\.\/([^"]+)"/.exec(html);
    expect(existsSync(new URL(`../../public/${og![1]}`, import.meta.url))).toBe(true);
    expect(existsSync(new URL('../../src-tauri/icons/icon.ico', import.meta.url))).toBe(true);
  });
  it('the chosen Light/Dark/System option is marked with more than colour', () => {
    expect(style).toMatch(/#theme-modes button\[aria-checked='true'\]::before \{ content: '✓ '; \}/);
  });
});

describe('stable layout', () => {
  it('keeps room for the scrollbar so the page never shifts sideways', () => {
    expect(style).toMatch(/html \{ scrollbar-gutter: stable; \}/);
  });
  it('gives every changing panel a fixed height and scrolls inside it', () => {
    for (const sel of ['#status', '.step-text', '#steps', '#history', '#io-msg']) {
      const rule = new RegExp(`${sel.replace(/[.#]/g, (c) => '\\' + c)} \\{[^}]*height: [0-9.]+(px|em)`);
      expect(style, sel).toMatch(rule);
    }
    expect(style).toMatch(/#steps \{[^}]*overflow-y: auto/);
    expect(style).toMatch(/#history \{[^}]*overflow-y: auto/);
  });
  it('labels that change text keep one width', () => {
    expect(style).toMatch(/#play \{ min-width: 6\.5em; \}/);
    expect(style).toMatch(/font-variant-numeric: tabular-nums/);
  });
  it('the grid stays square and scales to the screen', () => {
    expect(style).toMatch(/\.board \{[^}]*aspect-ratio: 1/);
    expect(style).toMatch(/main \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 420px/);
  });
});
