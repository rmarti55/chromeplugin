/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f8f6f3",
        ink: {
          DEFAULT: "#1c1917",
          body: "#44403c",
          secondary: "#57534e",
          muted: "#78716c",
        },
        accent: {
          DEFAULT: "#3d6b7a",
          dark: "#2f5561",
          hover: "#264a54",
          soft: "#dce8eb",
          softer: "#f4f8f9",
        },
        secondary: {
          DEFAULT: "#6b5d4d",
          soft: "#ede8e3",
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
