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
        primary: {
          DEFAULT: '#082D1B',
          foreground: '#F7F3E9',
        },
        secondary: {
          DEFAULT: '#0A3D25',
          foreground: '#E8E2D2',
        },
        'bg-primary': '#F7F3E9',
        'bg-secondary': '#F0EADA',
        'bg-surface': '#FFFFFF',
        'text-primary': '#0D2819',
        'text-secondary': '#5A6B5F',
        'text-muted': '#5F6E63',
        'accent-gold': '#D4AF37',
        'accent-warm': '#F5C542',
        error: '#DC2626',
        border: '#E5E0D4',
        muted: {
          DEFAULT: '#E8E2D2',
          foreground: '#5A6B5F',
        },
        accent: {
          DEFAULT: '#D4AF37',
          foreground: '#082D1B',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        background: '#F7F3E9',
        foreground: '#0D2819',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0D2819',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0D2819',
        },
        input: '#E5E0D4',
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
    },
  },
  plugins: [],}

export default config
