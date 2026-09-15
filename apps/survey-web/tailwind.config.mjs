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
        // Brand
        brand: {
          emerald: '#082D1B',
          emeraldLight: '#0A3D25',
          gold: '#D4AF37',
          warm: '#F5C542',
        },
        navy: {
          DEFAULT: '#0F172A',
          deep: '#0B1220',
        },
        surface: {
          DEFAULT: '#1E293B',
          elevated: '#243247',
          deep: '#16202F',
        },
        fg: {
          bright: '#F8FAFC',
          secondary: '#CBD5E1',
          muted: '#94A3B8',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#38BDF8',
        gold: '#D4AF37',
        warm: '#F5C542',

        // Backwards-compatible aliases used across the app
        primary: { DEFAULT: '#082D1B', foreground: '#F8FAFC' },
        secondary: { DEFAULT: '#1E293B', foreground: '#CBD5E1' },
        'bg-primary': '#0F172A',
        'bg-secondary': '#1E293B',
        'bg-surface': '#243247',
        'text-primary': '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted': '#94A3B8',
        'accent-gold': '#D4AF37',
        'accent-warm': '#F5C542',
        error: '#EF4444',
        border: '#334155',
        muted: { DEFAULT: '#1E293B', foreground: '#94A3B8' },
        accent: { DEFAULT: '#D4AF37', foreground: '#082D1B' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
        background: '#0F172A',
        foreground: '#F8FAFC',
        card: { DEFAULT: '#1E293B', foreground: '#F8FAFC' },
        popover: { DEFAULT: '#1E293B', foreground: '#F8FAFC' },
        input: '#334155',
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
        card: '0 18px 50px -22px rgba(2, 6, 23, 0.9)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #F5C542 0%, #D4AF37 55%, #B8912B 100%)',
        'emerald-gradient': 'linear-gradient(160deg, #0A3D25 0%, #082D1B 60%, #061F14 100%)',
        'hero-glow':
          'radial-gradient(60% 50% at 50% 0%, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0) 70%), radial-gradient(45% 40% at 85% 20%, rgba(10,61,37,0.6) 0%, rgba(10,61,37,0) 70%), linear-gradient(180deg, #0B1220 0%, #0F172A 60%, #131C2F 100%)',
      },
    },
  },
  plugins: [],
}
export default config