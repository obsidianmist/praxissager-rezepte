/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F8F6F2',
        'dark-bg': '#2C2A28', // Warm, dark gray
        'dark-surface': '#383532', // Slightly lighter warm dark gray
        'dark-text': '#F8F6F2', // Off-white for high contrast in dark mode
        'text-main': '#333333',
        primary: '#7A8B7C',
      },
      fontFamily: {
        sans: ['Inter', 'Montserrat', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem', // Make default rounding 2xl
      }
    },
  },
  plugins: [],
}
