/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — official Myanmar Beer palette (myanmar-brewery.com)
        brand: {
          emerald: '#163B2C',
          emeraldLight: '#1F4F35',
          green: '#00994B',
          greenLight: '#00A351',
          gold: '#D4AF37',
          warm: '#F5C542',
        },
        navy: {
          DEFAULT: '#0C2015',
          deep: '#08140D',
        },
        surface: {
          DEFAULT: '#1A2E20',
          elevated: '#22382A',
          deep: '#152B1D',
        },
        fg: {
          bright: '#F8FAFC',
          secondary: '#CBD5E1',
          muted: '#94A3B8',
        },
        success: '#00994B',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#38BDF8',
        gold: '#D4AF37',
        warm: '#F5C542',

        // Backwards-compatible aliases used across the app
        primary: { DEFAULT: '#163B2C', foreground: '#F8FAFC' },
        secondary: { DEFAULT: '#1A2E20', foreground: '#CBD5E1' },
        'bg-primary': '#0C2015',
        'bg-secondary': '#1A2E20',
        'bg-surface': '#22382A',
        'text-primary': '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted': '#94A3B8',
        'accent-gold': '#D4AF37',
        'accent-warm': '#F5C542',
        error: '#EF4444',
        border: '#2C4435',
        muted: { DEFAULT: '#1A2E20', foreground: '#94A3B8' },
        accent: { DEFAULT: '#D4AF37', foreground: '#163B2C' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
        background: '#0C2015',
        foreground: '#F8FAFC',
        card: { DEFAULT: '#1A2E20', foreground: '#F8FAFC' },
        popover: { DEFAULT: '#1A2E20', foreground: '#F8FAFC' },
        input: '#2C4435',
        ring: '#D4AF37',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        display: ['var(--font-poppins)', 'sans-serif'],
        myanmar: ['var(--font-noto-myanmar)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
      },
      boxShadow: {
        gold: '0 10px 40px -12px rgba(212, 175, 55, 0.45)',
        'gold-lg': '0 20px 60px -15px rgba(212, 175, 55, 0.5)',
        glow: '0 0 0 1px rgba(212,175,55,0.20), 0 10px 45px -12px rgba(212,175,55,0.35)',
        lager: '0 10px 40px -12px rgba(0, 153, 75, 0.45)',
        'lager-lg': '0 20px 60px -15px rgba(0, 153, 75, 0.5)',
        'glow-green': '0 0 0 1px rgba(0,153,75,0.20), 0 10px 45px -12px rgba(0,153,75,0.35)',
        card: '0 18px 50px -22px rgba(2, 6, 23, 0.9)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #F0E826 0%, #D4AF37 55%, #B8912B 100%)',
        'lager-gradient': 'linear-gradient(135deg, #00A351 0%, #00994B 55%, #008543 100%)',
        'emerald-gradient': 'linear-gradient(160deg, #1F4F35 0%, #163B2C 60%, #0B2014 100%)',
        'hero-glow':
          'radial-gradient(60% 50% at 50% 0%, rgba(0,153,75,0.22) 0%, rgba(0,153,75,0) 70%), radial-gradient(45% 40% at 85% 20%, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0) 70%), linear-gradient(180deg, #08140D 0%, #0C2015 60%, #10261A 100%)',
      },
    },
  },
  plugins: [],
}
export default config