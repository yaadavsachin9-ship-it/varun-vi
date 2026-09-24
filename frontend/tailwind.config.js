/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // UI COLOR SYSTEM — STRICT IMPLEMENTATION ROLES
        app: {
          bg: '#061826',
          sidebar: '#071F30',
          card: '#0B2638',
          panel: '#10384A',
          border: '#164E63',
        },
        brand: {
          DEFAULT: '#06B6D4',
          accent: '#06B6D4',
          secondary: '#22D3EE',
        },
        content: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
        },
        status: {
          safe: '#10B981',
          warning: '#FBBF24',
          high: '#F97316',
          critical: '#EF4444',
        },
        disaster: {
          dark: '#061826',
          sidebar: '#071F30',
          card: '#0B2638',
          surface: '#10384A',
          border: '#164E63',
          accent: '#06B6D4',
          cyan: '#22D3EE',
          text: '#F8FAFC',
          muted: '#94A3B8',
          green: '#10B981',
          yellow: '#FBBF24',
          orange: '#F97316',
          red: '#EF4444',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
