import animate from 'tailwindcss-animate';

const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const status = (name) => ({ fg: c(name), bg: c(`${name}-soft`) });

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', sm: '1.75rem', lg: '2.5rem' }, screens: { '2xl': '1280px' } },
    extend: {
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Archivo Variable"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: c('border'), rule: c('rule'), input: c('input'), ring: c('ring'), background: c('background'), foreground: c('foreground'),
        paper: c('paper'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
        brand: { DEFAULT: c('brand'), foreground: c('brand-foreground') },
        flame: { DEFAULT: c('flame'), foreground: c('flame-foreground') },
        status: { amber: status('amber'), blue: status('blue'), purple: status('purple'), green: status('green'), red: status('red'), grey: status('grey') },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 3px)', sm: 'calc(var(--radius) - 6px)' },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow) / .05)',
        lift: '0 24px 60px -24px hsl(var(--shadow) / .45)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        stamp: { '0%': { opacity: '0', transform: 'scale(1.6) rotate(-14deg)' }, '60%': { opacity: '1', transform: 'scale(.96) rotate(-7deg)' }, '100%': { opacity: '1', transform: 'scale(1) rotate(-7deg)' } },
      },
      animation: { rise: 'rise .6s cubic-bezier(.2,.7,.2,1) both', stamp: 'stamp .5s cubic-bezier(.2,.8,.2,1) .4s both' },
    },
  },
  plugins: [animate],
};
