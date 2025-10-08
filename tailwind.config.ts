import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff7ff',
          100: '#d0ebff',
          200: '#98d3ff',
          300: '#63c1ff',
          400: '#39a9ff',
          500: '#1b8de8',
          600: '#0f70c3',
          700: '#125ca0',
          800: '#134d83',
          900: '#123f6d'
        },
        accent: {
          50: '#fff5eb',
          100: '#ffe4c4',
          200: '#ffca89',
          300: '#ffac4d',
          400: '#ff931f',
          500: '#ff7a00',
          600: '#db5f00',
          700: '#b74600',
          800: '#923500',
          900: '#772c00'
        },
        slate: {
          950: '#1d1f25'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        brand: '0 30px 60px -40px rgba(18, 92, 160, 0.4)'
      }
    }
  },
  plugins: []
};

export default config;
