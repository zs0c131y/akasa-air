import animate from 'tailwindcss-animate';

const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const status = (name) => ({ fg: c(name), bg: c(`${name}-soft`) });

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }, screens: { '2xl': '1200px' } },
    extend: {
      fontFamily: {
        sans: ['"Geist Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Instrument Serif"', 'Iowan Old Style', 'Georgia', 'serif'],
      },
      colors: {
        border: c('border'), input: c('input'), ring: c('ring'), background: c('background'), foreground: c('foreground'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
        brand: { DEFAULT: c('brand'), foreground: c('brand-foreground') },
        status: { amber: status('amber'), blue: status('blue'), purple: status('purple'), green: status('green'), red: status('red'), grey: status('grey') },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow) / .06), 0 1px 3px hsl(var(--shadow) / .08)',
        lift: '0 10px 30px -12px hsl(var(--shadow) / .28), 0 2px 6px hsl(var(--shadow) / .08)',
      },
      keyframes: { rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } } },
      animation: { rise: 'rise .6s cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [animate],
};
