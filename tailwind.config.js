/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0d14',
          800: '#0f1422',
          700: '#151c2f',
          600: '#1e293b',
          500: '#334155',
        },
        brand: {
          green: '#00f298',
          cyan: '#00d2ff',
          purple: '#9d4edd',
          red: '#ff4d6d'
        }
      }
    },
  },
  plugins: [],
}
