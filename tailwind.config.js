/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#173F94', dark: '#112E70', 50: '#EEF3FC', 100: '#DCE6F8', 200: '#B9CCF0' },
        secondary: { DEFAULT: '#C92131', 50: '#FDEEEF' },
        bg: '#F4F7FC',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#152B49', soft: '#536984' },
        line: '#DCE3EE',
        success: { DEFAULT: '#137552', 50: '#E8F5EF' },
        warning: { DEFAULT: '#975807', 50: '#FDF3E3' },
        error: { DEFAULT: '#B51F31', 50: '#FCECEE' },
        info: { DEFAULT: '#2563EB', 50: '#EAF1FE' },
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px' },
      boxShadow: { card: '0 1px 2px rgba(21,43,73,0.06)', pop: '0 8px 24px rgba(21,43,73,0.14)' },
      keyframes: {
        scan: { '0%,100%': { top: '6%' }, '50%': { top: '88%' } },
        pulseRing: { '0%': { transform: 'scale(0.95)', opacity: '1' }, '100%': { transform: 'scale(1.25)', opacity: '0' } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        scan: 'scan 2s ease-in-out infinite',
        pulseRing: 'pulseRing 1.4s ease-out infinite',
        slideUp: 'slideUp .2s ease-out',
      },
    },
  },
  plugins: [],
};
