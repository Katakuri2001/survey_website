# Design System: Myanmar Beer Survey & Rewards
**Project ID:** alcohol-survey-platform

## 1. Visual Theme & Atmosphere
A moody, gallery-airy interface with confident asymmetric layouts and fluid spring-physics motion. The atmosphere is clinical yet warm — like a well-lit architecture studio meeting a smoky Myanmar beer hall. Rich dark neutrals (charcoal, warm brown) are punctuated by a singular champagne-gold accent that glows with intention. Motion is cinematic: wheels spin with weighted physics, confetti rains with gravity, and every interaction has a tactile, spring-loaded response.

Density sits at 4-5: enough content to feel substantial, but generous whitespace ensures no claustrophobia. Variance is 7-8: asymmetric card layouts, offset hero sections, and diagonal shadows break the grid. Motion is 8-9: cinematic choreography with spring physics, staggered reveals, and perpetual micro-loops on active components.

## 2. Color Palette & Roles
- **Canvas Black** (#20100F) — Primary background surface (deepest navy)
- **Rich Navy** (#2E1716) — Secondary background, card fills
- **Warm Dark** (#3B211F) — Surface elevated, input backgrounds
- **Deep Espresso** (#2A1615) — Deep shadows, text areas
- **Champagne Gold** (#E2C97F) — Primary accent for CTAs, active states, focus rings
- **Pale Gold** (#F7E7BC) — Warm highlights, gradients, text accents
- **Amber** (#C9A75F) — Gradient midpoints, subtle warmth
- **Stout Red** (#E01B2C) — Brand red accent, status indicators
- **Charcoal Ink** (#18181B) — Primary text color
- **Warm Gray** (#CBD5E1) — Secondary text, descriptions
- **Muted Rose** (#A99997) — Tertiary text, metadata
- **Border Warm** (#5A3833) — Structural borders
- **Success Green** (#00994B) — Positive status, confirmations
- **Error Red** (#EF4444) — Error states, warnings

**Accent:** Champagne Gold (#E2C97F) — Single accent, saturation < 80%. Used for all CTAs, active states, focus rings, and the gold gradient.

## 3. Typography Rules
- **Display:** Poppins — Track-tight, controlled scale, weight-driven hierarchy. Used for headlines, display text, and the gold-gradient hero text.
- **Body:** Inter — Relaxed leading, 65ch max-width, neutral secondary color. Used for body text, descriptions, and UI labels.
- **Myanmar:** Noto Sans Myanmar — For Myanmar/Burmese language text. Unicode-only, never Zawgyi.
- **Mono:** Geist Mono — For code, metadata, timestamps if needed.
- **Banned:** Inter for premium/creative contexts (use only for body). Serif fonts (Georgia, Times New Roman) are banned in dashboards and UI.

## 4. Component Stylings
- **Buttons:** Flat, no outer glow. Tactile -1px translate on active. Gold gradient fill for primary actions, ghost/outline for secondary. Generous padding (16-20px), 2xl border-radius.
- **Cards:** Generously rounded corners (1.75rem). Diffused whisper shadow. Used only when elevation communicates hierarchy. High-density: replace with border-top dividers.
- **Wheel Segments:** Generously rounded pie slices with counter-rotated labels. Each segment has a distinct beer-brand color from the Stout palette. Labels use backdrop-blur with semi-transparent navy backgrounds.
- **Pointer/Indicator:** Fixed at top of wheel, triangular gold pointer with a circular base. Subtle bounce animation on spin completion.
- **Inputs:** Label above, error below. Focus ring in gold color with 30% opacity. No floating labels. Generous padding, 2xl border-radius.
- **Loaders:** Skeletal shimmer matching exact layout dimensions. No circular spinners (except the brand ring on splash).
- **Toasts:** Pill-shaped, slide-up animation, color-coded by type (success=emerald, error=red, info=blue).
- **Header:** Glassmorphism sticky header with backdrop-filter blur. Gold-text brand name, back navigation, language switcher.

## 5. Layout Principles
- Grid-first responsive architecture using Tailwind CSS. Max-width containment at 2xl (1100px) for content areas.
- Centered layouts for the spin wheel with asymmetric ambient glow effects behind.
- No overlapping elements — every element occupies its own clear spatial zone.
- Full-height sections use `min-h-[100dvh]` — never `h-screen`.
- Responsive breakpoints: mobile-first collapse below 768px, all multi-column layouts collapse to single column.
- Touch targets minimum 44px.
- Section gaps use `clamp(3rem, 8vw, 6rem)`.

## 6. Motion & Interaction
- **Spring Physics default:** stiffness: 100, damping: 20 — premium, weighty feel. No linear easing for interactive elements.
- **Wheel Spin Animation:** Custom cubic-bezier keyframes with fast-start gradual slowdown and overshoot correction. 4.5s duration for premium feel. Indefinite spin starts instantly on button press for zero-input-lag feel.
- **Pointer Bounce:** Elastic bounce with `cubic-bezier(0.34, 1.56, 0.64, 1)` on spin completion. 600ms duration.
- **Confetti:** Multi-directional falling with rotation. Staggered cascade delays. 2.5-4.1s duration per piece.
- **Perpetual Micro-Interactions:** Every active component has an infinite loop state (pulse-gold on the wheel rim, float on ambient orbs).
- **Staggered Orchestration:** Never mount lists instantly — use cascade delays for waterfall reveals.
- **Performance:** Animate exclusively via `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`. Hardware-accelerated transforms only.
- **Reduced Motion:** Respects `prefers-reduced-motion: reduce` — replaces complex animations with simple quick rotations.

## 7. Anti-Patterns (Banned)
- No emojis anywhere
- No Inter font for premium/display contexts
- No generic serif fonts (Times New Roman, Georgia, Garamond)
- No pure black (#000000)
- No neon/outer glow shadows
- No oversaturated accents
- No excessive gradient text on large headers
- No custom mouse cursors
- No overlapping elements — clean spatial separation always
- No 3-column equal card layouts
- No generic names
- No fake round numbers
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash")
- No filler UI text: "Scroll to explore", "Swipe down", scroll arrows
- No broken Unsplash links
- No centered Hero sections (for high-variance projects)
- No `Inter` for display text (use Poppins instead)
- No CSS animations using `top`, `left`, `width`, `height` — only `transform` and `opacity`
