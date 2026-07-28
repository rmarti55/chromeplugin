/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f8f6f3",
        ink: {
          DEFAULT: "#1c1917",
          secondary: "#57534e",
          muted: "#a8a29e",
        },
        accent: {
          DEFAULT: "#b45309",
          soft: "#fef3c7",
          softer: "#fffbeb",
        },
      },
      fontFamily: {
        serif: ["Newsreader", "Georgia", "serif"],
        sans: ["Source Sans 3", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(28 25 23 / 0.05), 0 1px 2px -1px rgb(28 25 23 / 0.05)",
      },
    },
  },
  plugins: [],
};
