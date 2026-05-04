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

        // ── Surfaces ───────────────────────────────────────────────────────
        page:    '#F9FAFB',
        card:    '#FFFFFF',
        section: '#F3F4F6',

        // ── Status — always use text-* with matching bg-* ──────────────────
        confirmed: { DEFAULT: '#16A34A', bg: '#DCFCE7' },
        pending:   { DEFAULT: '#D97706', bg: '#FEF3C7' },
        overdue:   { DEFAULT: '#DC2626', bg: '#FEE2E2' },
        active:    { DEFAULT: '#16A34A', bg: '#DCFCE7' },
        inactive:  { DEFAULT: '#6B7280', bg: '#F3F4F6' },
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
