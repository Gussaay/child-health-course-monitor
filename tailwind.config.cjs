const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

/*
  The app's design tokens. Change a colour, corner or shadow here and every
  screen follows.
  - One grey: `gray-*` is drawn as `slate-*`, so the two greys the screens
    mixed now look the same. Likewise `green-*` is drawn as `emerald-*`.
  - good / partial / poor: status colours, same values as
    src/utils/statusColors.js.
  - Named colours for the shared pieces: brand (main colour), ink (text),
    muted (secondary text), line (borders), surface (page), card.
  - Three corner sizes: controls (fields, buttons) 8px, cards 12px,
    sheets and dialogs 16px. `rounded-sm` stays small for tiny bars.
  - Cards sit on a thin border; only floating things (menus, dialogs,
    toasts) get a real shadow (`shadow-lg` and up).
*/
const subtle = '0 1px 2px 0 rgb(15 23 42 / 0.06)';

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        gray: colors.slate,
        green: colors.emerald,
        brand: colors.sky,
        ink: colors.slate[800],
        muted: colors.slate[500],
        line: colors.slate[200],
        surface: colors.slate[50],
        card: colors.white,
        good: '#059669',
        partial: '#d97706',
        poor: '#dc2626',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1rem',
      },
      boxShadow: {
        sm: subtle,
        DEFAULT: subtle,
        md: subtle,
      },
    },
  },
  plugins: [],
};
