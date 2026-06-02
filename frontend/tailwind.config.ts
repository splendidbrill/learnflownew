import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        canvas: '#08060f',
        surface1: '#110c1d',
        surface2: '#1a1330',
        surface3: '#241a3e',
        hairline: '#251d3a',
        hairlineStrong: '#372a55',
        ink: '#f5f3fc',
        inkMuted: '#c5bedd',
        inkSubtle: '#8b84a6',
        inkTertiary: '#5d566f',
        primary: '#8b5cff',
        primaryHover: '#a585ff',
        magenta: '#ff3d8b',
        azure: '#3aa3ff',
        success: '#34d99c',
      },
      borderRadius: {
        xl2: '20px',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};
export default config;