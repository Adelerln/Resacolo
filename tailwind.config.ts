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
          50: '#f0f8ff',
          100: '#d6eeff',
          200: '#addcff',
          300: '#7ac5ff',
          400: '#47a7ff',
          500: '#2389f0',
          600: '#1668c2',
          700: '#114f9a',
          800: '#103f7a',
          900: '#112f5a'
        }
      }
    }
  },
  plugins: []
};

export default config;
