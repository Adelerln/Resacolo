import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '!./src/app/api/**/*',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2fbff',
          100: '#def4ff',
          200: '#bee8ff',
          300: '#9fdcff',
          400: '#83d1ff',
          500: '#6ec7ff',
          600: '#52b0ea',
          700: '#3898d1',
          800: '#2a7caf',
          900: '#245f84'
        },
        accent: {
          50: '#fff4ea',
          100: '#ffe5cf',
          200: '#ffd0a8',
          300: '#ffb274',
          400: '#ff993d',
          500: '#fa8500',
          600: '#f48200',
          700: '#d86c00',
          800: '#b85a00',
          900: '#924700'
        },
        surface: {
          50: '#f8f8f8'
        },
        ink: {
          500: '#404040'
        },
        slate: {
          950: '#1d1f25'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        accent: ['var(--font-accent)']
      },
      boxShadow: {
        brand: '0 30px 60px -40px rgba(82, 176, 234, 0.35)'
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        marquee: 'marquee 35s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
