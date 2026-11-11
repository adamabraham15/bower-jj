/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bower: {
          gold: '#f59e0b',
          cyan: '#06b6d4',
          felt: '#08282b',
        }
      }
    },
  },
  plugins: [],
}
