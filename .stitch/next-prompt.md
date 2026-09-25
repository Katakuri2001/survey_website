---
page: spin-wheel-enhancement
---
Enhanced spin wheel and reward animations for Myanmar Beer Survey & Rewards platform.

**DESIGN SYSTEM (REQUIRED):**
# Design System: Myanmar Beer Survey & Rewards
**Project ID:** alcohol-survey-platform

## 1. Visual Theme & Atmosphere
A moody, gallery-airy interface with confident asymmetric layouts and fluid spring-physics motion. The atmosphere is clinical yet warm — like a well-lit architecture studio meeting a smoky Myanmar beer hall. Rich dark neutrals (charcoal, warm brown) are punctuated by a singular champagne-gold accent that glows with intention. Motion is cinematic: wheels spin with weighted physics, confetti rains with gravity, and every interaction has a tactile, spring-loaded response.

Density sits at 4-5: enough content to feel substantial, but generous whitespace ensures no claustrophobia. Variance is 7-8: asymmetric card layouts, offset hero sections, and diagonal shadows break the grid. Motion is 8-9: cinematic choreography with spring physics, staggered reveals, and perpetual micro-loops on active components.

## 2. Color Palette & Roles
- **Canvas Black** (#20100F) — Primary background surface
- **Rich Navy** (#2E1716) — Secondary background
- **Warm Dark** (#3B211F) — Surface elevated
- **Champagne Gold** (#E2C97F) — Primary accent
- **Pale Gold** (#F7E7BC) — Warm highlights
- **Stout Red** (#E01B2C) — Brand red accent
- **Charcoal Ink** (#18181B) — Primary text
- **Warm Gray** (#CBD5E1) — Secondary text
- **Muted Rose** (#A99997) — Tertiary text
- **Border Warm** (#5A3833) — Structural borders

## 6. Motion & Interaction
- **Spring Physics:** stiffness: 100, damping: 20 — premium, weighty feel
- **Wheel Spin:** Custom cubic-bezier keyframes, 4.5s duration, fast-start gradual slowdown
- **Pointer Bounce:** Elastic bounce, cubic-bezier(0.34, 1.56, 0.64, 1), 600ms
- **Confetti:** Multi-directional falling with rotation, staggered cascade delays
- **Perpetual Micro-Interactions:** Infinite loop states on active components
- **Hardware-accelerated transforms only** — no top/left/width/height animations

**Page Structure:**
1. **Header:** Glassmorphism sticky header with gold-text brand, back navigation, language switcher
2. **Wheel Section:** Centered roulette wheel with 6 segments, gold pointer at top, ambient glow effects, enhanced spin animation with spring physics
3. **Reward Reveal:** Enhanced confetti explosion, winner card with staggered animations, gold shimmer effects, pulsing celebration glow
4. **Action Section:** Claim reward button with hover scale, done button with transition

**Enhanced Animations Required:**
- Wheel spin with spring physics deceleration and overshoot correction
- Pointer elastic bounce on completion
- Multi-layer confetti with rotation and gravity
- Winner card with staggered reveal animation
- Ambient glow pulse with golden shimmer
- Reduced motion support
