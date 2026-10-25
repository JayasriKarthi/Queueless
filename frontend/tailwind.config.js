/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#0E9F8E', hover: '#0B8577', 50: '#E7F6F4', 100: '#C7EBE6', 600: '#0E9F8E', 700: '#0B8577', 900: '#064E46' },
        ink: { DEFAULT: '#0B1F1C', soft: '#163330' },
        cream: '#F6F6F1',
        admin: {
          bg: '#F1F1F1',
          border: '#E3E3E3',
          top: '#1A1A1A',
          search: '#303030',
          primary: '#303030',
          muted: '#616161',
          input: '#8A8A8A',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(40px, 7.4vw, 88px)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-sm': ['clamp(32px, 5vw, 60px)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        card: '0 1px 0 rgba(26,26,26,.07)',
        pop: '0 8px 24px rgba(26,26,26,.16), 0 1px 0 rgba(26,26,26,.07)',
        mock: '0 30px 60px -20px rgba(11,31,28,.35)',
      },
      borderRadius: { xl2: '24px' },
      maxWidth: { site: '1280px', admin: '1000px' },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        flash: { '0%,100%': { opacity: 0 }, '20%': { opacity: 0.6 } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        slideInLeft: { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-up': 'fadeUp .6s ease-out both',
        flash: 'flash 1.2s ease-out',
        'slide-in': 'slideIn .22s ease-out',
        'slide-in-left': 'slideInLeft .22s ease-out',
        pop: 'pop .16s ease-out',
      },
    },
  },
  plugins: [],
};
