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
        // ── Brand ──────────────────────────────────────────────────────────
        primary: {
          DEFAULT: '#2F4A7D',
          50:  '#EDF3FF',
          100: '#D8E2F2',
          200: '#B8C8E2',
          300: '#8FA8D1',
          400: '#637FB1',
          500: '#2F4A7D',
          600: '#283F6E',
          700: '#233761',
          800: '#1E3158',
          900: '#1E3158',
          950: '#14213F',
        },

        accent: {
          DEFAULT: '#C34A1A',
          hero: '#FFB14A',
          bg: '#FFF0EA',
        },

        // ── Surfaces ───────────────────────────────────────────────────────
        page:    '#F7F6F3',
        card:    '#FFFFFF',
        section: '#F1EFEC',

        // ── Status — always use text-* with matching bg-* ──────────────────
        confirmed: { DEFAULT: '#14804A', bg: '#EAF7EF' },
        pending:   { DEFAULT: '#D99A2B', bg: '#FFFBEB' },
        overdue:   { DEFAULT: '#DC2626', bg: '#FEE2E2' },
        active:    { DEFAULT: '#14804A', bg: '#EAF7EF' },
        inactive:  { DEFAULT: '#6B7280', bg: '#F1EFEC' },
      },

      fontFamily: {
        sans:     ['Inter-Regular',  'system-ui', 'normal'],
        medium:   ['Inter-Medium',   'system-ui', 'normal'],
        semibold: ['Inter-SemiBold', 'system-ui', 'normal'],
        bold:     ['Inter-Bold',     'system-ui', 'normal'],
      },

      fontSize: {
        xs:   ['11px', { lineHeight: '16px' }],
        sm:   ['13px', { lineHeight: '18px' }],
        base: ['15px', { lineHeight: '22px' }],
        md:   ['17px', { lineHeight: '24px' }],
        lg:   ['20px', { lineHeight: '28px' }],
        xl:   ['24px', { lineHeight: '32px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['34px', { lineHeight: '42px' }],
      },

      borderRadius: {
        sm:   '6px',
        md:   '10px',
        lg:   '14px',
        xl:   '20px',
        full: '9999px',
      },

      spacing: {
        1:  '4px',
        2:  '8px',
        3:  '12px',
        4:  '16px',
        5:  '20px',
        6:  '24px',
        8:  '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
    },
  },
  plugins: [],
};
