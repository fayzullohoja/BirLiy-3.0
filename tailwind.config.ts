import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0faf4',
          100: '#dcf5e7',
          200: '#bbebd2',
          300: '#88d9b3',
          400: '#4fc18c',
          500: '#28a46e',
          600: '#1a8458',
          700: '#166a48',
          800: '#14543a',
          900: '#114530',
          950: '#082a1d',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f6f8f7',
          border:  '#e4ebe7',
        },
        ink: {
          DEFAULT: '#0f1f18',
          secondary: '#4a6358',
          muted: '#8aa898',
        },
        danger:  '#e53e3e',
        warning: '#d97706',
        info:    '#2563eb',
        success: '#16a34a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-md': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'card-lg': '0 8px 24px 0 rgb(0 0 0 / 0.10), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top':    'env(safe-area-inset-top)',
      },
      minHeight: {
        touch: '48px',
      },
    },
  },
  plugins: [],
}

export default config
