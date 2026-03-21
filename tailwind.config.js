/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./types.ts",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'invox-dark': '#0A0A0A',
        'invox-dark-accent': '#141414',
        'invox-light-gray': '#B3B3B3',
        'invox-red': '#E50914',
        'invox-red-hover': '#F6121D',
        'invox-red-text': '#FF4747',
        'invox-blue': '#0052FF',
        gray: {
          800: '#1E1E1E',
          700: '#262B33',
        },
      },
    },
  },
  plugins: [],
};
