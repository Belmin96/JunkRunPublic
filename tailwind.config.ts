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
        brand: {
          DEFAULT: '#A8FF00',
          dark: '#70C900',
          light: '#EFFFCC',
        },
        ink: '#0D1109',
        bg: '#0D1109',
        card: '#171D11',
        border: {
          DEFAULT: '#29321F',
          '2': '#3A472B',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      maxWidth: {
        phone: '430px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
