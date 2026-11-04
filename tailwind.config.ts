import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['"Geist Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      backgroundColor: {
        'app':      'var(--bg)',
        'surface':  'var(--surface)',
        'surface2': 'var(--surface-2)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      textColor: {
        primary:   'var(--text)',
        secondary: 'var(--text-2)',
        tertiary:  'var(--text-3)',
      },
    },
  },
  // hover: utilities only apply on devices with a real pointer — no stuck hover after a tap
  future: { hoverOnlyWhenSupported: true },
  plugins: [],
}
export default config
