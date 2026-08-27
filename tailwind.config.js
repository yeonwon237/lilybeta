/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lily: {
          50: '#FDF8FA',
          100: '#FCEEF4',
          200: '#F9DCE8',
          300: '#F4BED5',
          400: '#EB94BA',
          500: '#DD6B9A',
          600: '#C74A7C',
          700: '#A93561',
          800: '#8C2E52',
          900: '#752A47',
        },
        cream: {
          50: '#FDFCF9',
          100: '#FAF7F0',
          200: '#F4EFE2',
          300: '#ECE3D0',
          400: '#DFD2B7',
          500: '#C8B693',
          600: '#B09B74',
          700: '#8C7A58',
          800: '#706248',
          900: '#5C513D',
        },
        ink: {
          50: '#F6F5F4',
          100: '#EAE8E5',
          200: '#D5D1CB',
          300: '#B8B1A8',
          400: '#948B80',
          500: '#776D61',
          600: '#5E554B',
          700: '#4A433A',
          800: '#342F29',
          900: '#1F1C18',
          950: '#141210',
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Literata"', '"Merriweather"', '"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
