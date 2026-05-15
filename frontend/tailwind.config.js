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
          page: 'var(--theme-page-bg)',
          foreground: 'var(--theme-page-fg)',
          muted: 'var(--theme-text-muted)',
          border: 'var(--theme-border)',
          subtle: 'var(--theme-surface-subtle)',
          elevated: 'var(--theme-surface-elevated)',
          accent: 'var(--theme-accent)',
          'accent-fg': 'var(--theme-accent-foreground)',
          nav: 'var(--theme-nav-bg)',
        },
        brand: {
          obsidian: 'var(--color-deep-obsidian)',
          crema: 'var(--color-roasted-crema)',
          charcoal: 'var(--color-ash-charcoal)',
          rose: 'var(--color-muted-rose)',
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
