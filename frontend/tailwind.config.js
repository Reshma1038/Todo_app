/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#c2d3fd",
          300: "#93b0fb",
          400: "#6a90f8",
          500: "#3b6ef6",
          600: "#2f5ae0",
          700: "#2748b8",
        },
      },
    },
  },
  plugins: [],
};
