/*
  Dark mode. Every colour utility reads a CSS variable, so the whole app
  (about 8,000 class names) changes with one switch: `html.dark` on screen.
  Printing and PDF capture always stay light.

  Rules (dark side only):
  - Backgrounds: the pale steps 50-300 become deep tints; 400+ (buttons, badges,
    the dark header) stay as they are.
  - Text: the dark steps 600-950 become light; the light steps (used on the
    dark header and on buttons) stay.
  - Borders / rings / dividers: pale steps become deep tints.
  `.theme-light` on an element keeps that part light (certificates, printable reports).
*/
const plugin = require('tailwindcss/plugin');
const colors = require('tailwindcss/colors');

const PALETTES = ['slate', 'red', 'orange', 'amber', 'yellow', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose'];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

// Hand-tuned neutral steps for the dark side.
const SLATE_DARK_BG = { 50: '#0a101c', 100: '#1a2438', 200: '#26324a', 300: '#34425c' };
const SLATE_DARK_BD = { 50: '#1a2438', 100: '#1e2a40', 200: '#2a374f', 300: '#3a4962', 400: '#475569' };
const SLATE_DARK_TX = { 400: '#7a89a0', 500: '#94a3b8', 600: '#a9b6c9', 700: '#cbd5e1', 800: '#e2e8f0', 900: '#f1f5f9', 950: '#f8fafc' };
const CARD_DARK = '#131c2b';

const TINT_BG = { 50: 950, 100: 900, 200: 800, 300: 700 };
const TEXT_UP = { 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };

function darkValue(kind, palette, shade) {
  const pal = colors[palette];
  if (palette === 'slate') {
    if (kind === 'bg') return SLATE_DARK_BG[shade] || pal[shade];
    if (kind === 'bd') return SLATE_DARK_BD[shade] || pal[shade];
    return SLATE_DARK_TX[shade] || pal[shade];
  }
  if (kind === 'tx') return pal[TEXT_UP[shade] || shade];
  return pal[TINT_BG[shade] || shade];
}

const lightVars = {};
const darkVars = {};
const maps = { bg: {}, tx: {}, bd: {} };
for (const kind of ['bg', 'tx', 'bd']) {
  for (const p of PALETTES) {
    maps[kind][p] = {};
    for (const s of SHADES) {
      const v = `--${kind}-${p}-${s}`;
      lightVars[v] = rgb(colors[p][s]);
      darkVars[v] = rgb(darkValue(kind, p, s));
      maps[kind][p][s] = `rgb(var(${v}) / <alpha-value>)`;
    }
  }
}
// Named tokens.
lightVars['--bg-white'] = '255 255 255';
darkVars['--bg-white'] = rgb(CARD_DARK);
lightVars['--bg-surface'] = rgb(colors.slate[50]);
darkVars['--bg-surface'] = rgb(SLATE_DARK_BG[50]);
lightVars['--tx-ink'] = rgb(colors.slate[800]);
darkVars['--tx-ink'] = rgb('#e2e8f0');
lightVars['--tx-muted'] = rgb(colors.slate[500]);
darkVars['--tx-muted'] = rgb('#94a3b8');

const alias = (m) => ({ ...m, gray: m.slate, green: m.emerald, brand: m.sky });

module.exports = {
  extend: {
    backgroundColor: { ...alias(maps.bg), surface: 'rgb(var(--bg-surface) / <alpha-value>)', card: 'rgb(var(--bg-white) / <alpha-value>)' },
    gradientColorStops: { ...alias(maps.bg), surface: 'rgb(var(--bg-surface) / <alpha-value>)', card: 'rgb(var(--bg-white) / <alpha-value>)' },
    textColor: { ...alias(maps.tx), ink: 'rgb(var(--tx-ink) / <alpha-value>)', muted: 'rgb(var(--tx-muted) / <alpha-value>)' },
    placeholderColor: { ...alias(maps.tx) },
    borderColor: { ...alias(maps.bd), line: 'rgb(var(--bd-slate-200) / <alpha-value>)', card: 'rgb(var(--bg-white) / <alpha-value>)' },
    divideColor: { ...alias(maps.bd), line: 'rgb(var(--bd-slate-200) / <alpha-value>)' },
    ringColor: { ...alias(maps.bd), line: 'rgb(var(--bd-slate-200) / <alpha-value>)' },
  },
  plugin: plugin(({ addBase, addUtilities }) => {
    addBase({
      ':root, html.dark .theme-light': lightVars,
      '@media screen': { 'html.dark': { ...darkVars, 'color-scheme': 'dark' } },
    });
    // White surfaces follow the theme; translucent white highlights stay white.
    const w = (sel, a) => ({ [sel]: { 'background-color': `rgb(var(--bg-white) / ${a})` } });
    addUtilities({
      ...w('.bg-white', '1'),
      ...w('.hover\\:bg-white:hover', '1'),
      ...w('.focus\\:bg-white:focus', '1'),
      ...w('.odd\\:bg-white:nth-child(odd)', '1'),
      ...w('.bg-white\\/95', '.95'),
      ...w('.bg-white\\/90', '.9'),
      ...w('.bg-white\\/80', '.8'),
      ...w('.bg-white\\/70', '.7'),
      ...w('.bg-white\\/60', '.6'),
    });
  }),
};
