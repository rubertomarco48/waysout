/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#070B14",
          900: "#0B1120",
          800: "#111A2E",
          700: "#182543",
          600: "#24314F",
          500: "#39496E",
        },
        amber: {
          400: "#F5BB5C",
          500: "#F2A93B",
          600: "#D98E1F",
        },
        mist: {
          400: "#8B98B8",
          300: "#AEB9D4",
        },
        savings: "#4ADE9C",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
