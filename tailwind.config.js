/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nature Climate Artisan palette
        bark: {
          50: '#f7f5f0', 100: '#ebe5d8', 200: '#d6cab3', 300: '#bdaa85',
          400: '#a08a5f', 500: '#856d44', 600: '#6b5736', 700: '#56462d',
          800: '#433829', 900: '#2e2820', 950: '#1c1812',
        },
        moss: {
          50: '#f3f6f1', 100: '#e3ebe0', 200: '#c7d6c2', 300: '#a3bb9c',
          400: '#7d9a74', 500: '#5e7d56', 600: '#486343', 700: '#3a4f37',
          800: '#30402e', 900: '#283627', 950: '#141d13',
        },
        clay: {
          50: '#fbf6f0', 100: '#f5e8d8', 200: '#eacfb0', 300: '#dcae80',
          400: '#cd8a52', 500: '#c0713a', 600: '#a85a2e', 700: '#8a4628',
          800: '#703929', 900: '#5d3225', 950: '#331a13',
        },
        sage: {
          50: '#f4f7f4', 100: '#e6eee6', 200: '#cadcca', 300: '#a3c2a4',
          400: '#7aa47c', 500: '#5a8a5d', 600: '#476e4a', 700: '#3a593d',
          800: '#314a33', 900: '#2a3f2c', 950: '#15221a',
        },
        stone: {
          50: '#f8f8f6', 100: '#f0f0ec', 200: '#e2e1db', 300: '#cdcac1',
          400: '#b0aca0', 500: '#948f80', 600: '#7a7567', 700: '#625e53',
          800: '#524e46', 900: '#43403a', 950: '#2a2824',
        },
        leaf: {
          50: '#f0f7ee', 100: '#dcebd6', 200: '#bbd8b3', 300: '#8fbd85',
          400: '#649a59', 500: '#477d3c', 600: '#386430', 700: '#2f5029',
          800: '#284023', 900: '#22361f', 950: '#0f1d0d',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(67, 64, 58, 0.12)',
        glow: '0 0 0 3px rgba(100, 154, 89, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'pulse-soft': 'pulseSoft 1.5s ease-in-out infinite',
        'typing': 'typing 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        typing: { '0%, 100%': { transform: 'translateY(0)', opacity: '0.4' }, '50%': { transform: 'translateY(-4px)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
