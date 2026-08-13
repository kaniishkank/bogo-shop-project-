/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sleek premium slate & violet theme
        dark: {
          bg: '#0B0F19',
          card: '#151D30',
          border: '#23304D',
          hover: '#1E2942'
        }
      }
    },
  },
  plugins: [],
}
