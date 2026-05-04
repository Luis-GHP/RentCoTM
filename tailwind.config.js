/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B3C34',
          50:  '#E8F5F0',
          100: '#C6E8DC',
          200: '#8FD0B8',
          300: '#57B894',
          400: '#2E9A72',
          500: '#1F7A58',
          600: '#185E44',
          700: '#144F3A',
          800: '#103F2F',
          900: '#1B3C34',
          950: '#0D2420',
        },
      },
    },
  },
  plugins: [],
};
