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
          DEFAULT: '#64748B',
          foreground: '#F8FAFC',
        },
        'bg-primary': '#F7F3E9',
        'bg-secondary': '#F0EADA',
        'bg-surface': '#FFFFFF',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        'text-muted': '#64748B',
        'accent-gold': '#D4AF37',
        'accent-warm': '#F5C542',
        error: '#DC2626',
        border: '#E5E0D4',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#D4AF37',
          foreground: '#082D1B',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        background: '#F8FAFC',
        foreground: '#0F172A',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        input: '#CBD5E1',
        ring: '#D4AF37',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        display: ['Poppins', 'sans-serif'],
        myanmar: ['"Noto Sans Myanmar"', 'system-ui', 'sans-serif'],
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
