/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060d18',
          900: '#0d1b2e',
          800: '#112238',
          700: '#162d47',
          600: '#1e3d5c',
        },
        accent: '#3872c8',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
    },
  },
  plugins: [],
}
