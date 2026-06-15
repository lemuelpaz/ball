import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-fast': 'pulse 0.5s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { textShadow: '0 0 10px #FFD700, 0 0 20px #FFD700' },
          '50%': { textShadow: '0 0 20px #FFD700, 0 0 40px #FFD700, 0 0 60px #FFD700' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}

export default config
