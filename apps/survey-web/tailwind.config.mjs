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
        // Brand — Myanmar Stout palette (dark brown · red band · champagne gold)
        brand: {
          emerald: '#3B1F1D',
          emeraldLight: '#55312D',
          green: '#E01B2C',
          greenLight: '#F04450',
          gold: '#E2C97F',
          warm: '#F7E7BC',
        },
        navy: {
          DEFAULT: '#2E1716',
          deep: '#20100F',
        },
        surface: {
          DEFAULT: '#3B211F',
          elevated: '#4A2B28',
          deep: '#2A1615',
        },
        fg: {
          bright: '#F8FAFC',
          secondary: '#CBD5E1',
          muted: '#A99997',
        },
        success: '#00994B',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#38BDF8',
        gold: '#E2C97F',
        warm: '#F7E7BC',

        // Backwards-compatible aliases used across the app
        primary: { DEFAULT: '#3B1F1D', foreground: '#F8FAFC' },
        secondary: { DEFAULT: '#3B211F', foreground: '#CBD5E1' },
        'bg-primary': '#2E1716',
        'bg-secondary': '#3B211F',
        'bg-surface': '#4A2B28',
        'text-primary': '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted': '#A99997',
        'accent-gold': '#E2C97F',
        'accent-warm': '#F7E7BC',
        error: '#EF4444',
        border: '#5A3833',
        muted: { DEFAULT: '#3B211F', foreground: '#A99997' },
        accent: { DEFAULT: '#E2C97F', foreground: '#3B1F1D' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
        background: '#2E1716',
        foreground: '#F8FAFC',
        card: { DEFAULT: '#3B211F', foreground: '#F8FAFC' },
        popover: { DEFAULT: '#3B211F', foreground: '#F8FAFC' },
        input: '#5A3833',
        ring: '#E2C97F',
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
        gold: '0 10px 40px -12px rgba(226, 201, 127, 0.45)',
        'gold-lg': '0 20px 60px -15px rgba(226, 201, 127, 0.5)',
        glow: '0 0 0 1px rgba(226,201,127,0.20), 0 10px 45px -12px rgba(226,201,127,0.35)',
        lager: '0 10px 40px -12px rgba(224, 27, 44, 0.45)',
        'lager-lg': '0 20px 60px -15px rgba(224, 27, 44, 0.5)',
        'glow-green': '0 0 0 1px rgba(224,27,44,0.20), 0 10px 45px -12px rgba(224,27,44,0.35)',
        card: '0 18px 50px -22px rgba(12, 5, 4, 0.9)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #F5E7B8 0%, #E2C97F 55%, #C9A75F 100%)',
        'lager-gradient': 'linear-gradient(135deg, #F03A46 0%, #E01B2C 55%, #B8121F 100%)',
        'emerald-gradient': 'linear-gradient(160deg, #55312D 0%, #3B1F1D 60%, #20100F 100%)',
        'hero-glow':
          'radial-gradient(60% 50% at 50% 0%, rgba(224,27,44,0.20) 0%, rgba(224,27,44,0) 70%), radial-gradient(45% 40% at 85% 20%, rgba(226,201,127,0.10) 0%, rgba(226,201,127,0) 70%), linear-gradient(180deg, #20100F 0%, #2E1716 60%, #3A1D1B 100%)',
      },
    },
  },
  plugins: [],
}
export default config