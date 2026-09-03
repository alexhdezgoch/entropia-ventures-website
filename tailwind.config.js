/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './blog/**/*.html',
    './audits/**/*.html',
    './demo/**/*.html',
    './scripts/prerender-audits.js',
    './assets/js/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // Dark-canon tokens (from index.html's inline config — the current
        // site theme). Where a legacy audits/detail/index.html token name
        // collides with one of these (only "surface" does), the dark-canon
        // value wins per spec.
        base: '#050f0b',
        'base-deep': '#00130d',
        surface: '#0a1a13',
        'surface-2': '#10231a',
        line: '#1d332a',
        ink: '#f9f9f8',
        'ink-dim': '#9fb3aa',
        'ink-faint': '#8fa39a',
        gold: '#C9A84C',
        'gold-bright': '#ffe08f',
        'gold-dim': '#8a7434',

        // Legacy tokens from audits/detail/index.html's inline config.
        // "surface" is intentionally omitted here — it collides with the
        // dark-canon "surface" above (#0a1a13 vs #f9f9f8) and the dark-canon
        // value is kept per spec.
        primary: '#00130d',
        'primary-container': '#0f2921',
        'on-primary': '#ffffff',
        'on-primary-container': '#769287',
        secondary: '#C9A84C',
        'secondary-dark': '#316948',
        'surface-container-low': '#f3f4f3',
        'surface-container': '#eeeeed',
        'surface-container-high': '#e8e8e7',
        'surface-container-highest': '#e2e2e2',
        'on-surface': '#1a1c1c',
        'on-surface-variant': '#424845',
        outline: '#727975',
        'outline-variant': '#c2c8c4',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
      },
      fontFamily: {
        serif: ['Noto Serif', 'serif'],
        sans: ['Inter', 'sans-serif'],
        headline: ['Noto Serif'],
        body: ['Inter'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
