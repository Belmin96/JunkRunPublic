import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // JunkRun brand — lime green + near-black, lifted from the logo, on a
        // clean light UI so it's pleasant for long dashboard/form sessions.
        brand: {
          DEFAULT: '#63C21B',
          dark: '#4A9A12',
          light: '#E8F7D9',
        },
        ink: '#10140C',
        bg: '#F7FAF3',
        card: '#FFFFFF',
        border: {
          DEFAULT: '#E3E9DB',
          '2': '#D3DCC7',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      maxWidth: {
        phone: '430px', // common modern phone logical width (iPhone 14/15 Pro Max ≈ 430pt) — used as the app "shell" so it feels native on any screen
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
