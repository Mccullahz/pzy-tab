/* Bridges a CSS-var colour into Tailwind so the `/opacity` modifier works.
   Tailwind can only inject an alpha channel into a colour it can parse, so a
   bare `var(--x)` silently emits NO rule for `bg-x/10` and friends. Mixing
   toward transparent gives the same result while keeping the vars opaque and
   themeable from index.css. */
const themed =
  (variable) =>
  ({ opacityValue } = {}) => {
    if (opacityValue === undefined) return `var(${variable})`;
    const n = Number(opacityValue);
    const pct = Number.isFinite(n) ? `${n * 100}%` : `calc(${opacityValue} * 100%)`;
    return `color-mix(in srgb, var(${variable}) ${pct}, transparent)`;
  };

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        container: '1280px',
      },
      spacing: {
        gutter: '24px',
        page: '40px',
      },
      borderRadius: {
        design: '1rem',
        'design-lg': '2rem',
        'design-xl': '3rem',
      },
      transitionTimingFunction: {
        quiet: 'var(--ease-quiet)',
      },
      transitionDuration: {
        comfortable: 'var(--duration-comfortable)',
      },
      /* Tailwind consumes modular CSS vars — remap in one place via index.css */
      colors: {
        theme: {
          page: themed('--theme-page-bg'),
          foreground: themed('--theme-page-fg'),
          muted: themed('--theme-text-muted'),
          border: themed('--theme-border'),
          subtle: themed('--theme-surface-subtle'),
          elevated: themed('--theme-surface-elevated'),
          accent: themed('--theme-accent'),
          'accent-fg': themed('--theme-accent-foreground'),
          nav: themed('--theme-nav-bg'),
          /* fulfillment status roles — see index.css */
          'status-waiting': themed('--theme-status-waiting'),
          'status-active': themed('--theme-status-active'),
          'status-done': themed('--theme-status-done'),
          'status-away': themed('--theme-status-away'),
          'status-warn': themed('--theme-status-warn'),
          'status-dead': themed('--theme-status-dead'),
        },
        brand: {
          obsidian: themed('--color-deep-obsidian'),
          crema: themed('--color-roasted-crema'),
          charcoal: themed('--color-ash-charcoal'),
          rose: themed('--color-muted-rose'),
        },
        rl: {
          surface: 'var(--rl-color-surface)',
          'surface-dim': 'var(--rl-color-surface-dim)',
          'surface-bright': 'var(--rl-color-surface-bright)',
          'surface-lowest': 'var(--rl-color-surface-container-lowest)',
          'surface-low': 'var(--rl-color-surface-container-low)',
          'surface-container': 'var(--rl-color-surface-container)',
          'surface-high': 'var(--rl-color-surface-container-high)',
          'surface-highest': 'var(--rl-color-surface-container-highest)',
          'on-surface': 'var(--rl-color-on-surface)',
          'on-surface-variant': 'var(--rl-color-on-surface-variant)',
          outline: 'var(--rl-color-outline)',
          'outline-variant': 'var(--rl-color-outline-variant)',
          'surface-tint': 'var(--rl-color-surface-tint)',
          primary: 'var(--rl-color-primary)',
          'on-primary': 'var(--rl-color-on-primary)',
          'primary-container': 'var(--rl-color-primary-container)',
          'on-primary-container': 'var(--rl-color-on-primary-container)',
          secondary: 'var(--rl-color-secondary)',
          'on-secondary': 'var(--rl-color-on-secondary)',
          'secondary-container': 'var(--rl-color-secondary-container)',
          background: 'var(--rl-color-background)',
          'on-background': 'var(--rl-color-on-background)',
          'surface-variant': 'var(--rl-color-surface-variant)',
        },
      },
      animation: {
        wave: 'wave 10s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateY(0)' },
          '20%': { transform: 'translateY(-20%)' },
          '40%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
