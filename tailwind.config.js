/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        messenger: {
          blue: '#0084ff',
          gray: '#f0f2f5',
          dark: '#1c1e21',
          border: '#e4e6eb',
        }
      }
    },
  },
  plugins: [],
}
