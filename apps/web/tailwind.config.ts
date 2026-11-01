import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#0a0a0b',
          raised: '#111114',
          overlay: '#18181c',
          subtle: '#1f1f25',
        },
        border: {
          subtle: '#2a2a35',
          DEFAULT: '#35353f',
          strong: '#4a4a55',
        },
        text: {
          primary: '#f0f0f4',
          secondary: '#9090a0',
          muted: '#606070',
        },
        accent: {
          DEFAULT: '#5b63f5',
          hover: '#6b73ff',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
        risk: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#ef4444',
          critical: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
