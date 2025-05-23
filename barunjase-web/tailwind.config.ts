import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Add other paths that may contain Tailwind class names
  ],
  theme: {
    extend: {
      // Extend Tailwind's default theme here if needed
      // For example, adding custom colors, fonts, etc.
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        'pulse-border-red': {
          '0%, 100%': { borderColor: 'rgba(239, 68, 68, 0.4)' }, // red-500 at 40% opacity
          '50%': { borderColor: 'rgba(239, 68, 68, 1)' },    // red-500 at 100% opacity
        },
        'pulse-border-yellow': {
          '0%, 100%': { borderColor: 'rgba(245, 158, 11, 0.4)' }, // yellow-500 at 40% opacity
          '50%': { borderColor: 'rgba(245, 158, 11, 1)' },   // yellow-500 at 100% opacity
        },
      },
      animation: {
        'pulse-border-red': 'pulse-border-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-border-yellow': 'pulse-border-yellow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    // Add any Tailwind CSS plugins here
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/forms'),
  ],
};

export default config; 