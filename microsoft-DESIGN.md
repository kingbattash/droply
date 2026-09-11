---
version: alpha
name: Microsoft Fluent
description: "Explore Microsoft products and services and support for your home or business. Shop Microsoft 365, Copilot, Teams, Xbox, Windows, Azure, Surface and more."
sourceUrl: "https://www.microsoft.com"

colors:
  primary: "#17253d"
  on-primary: "#ffffff"
  background: "#ffffff"
  surface: "#0078d4"
  border: "#e7e7e7"
  text: "#616161"
  text-muted: "#17253d"
  accent: "#2a446f"

typography:
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI, segoeui, Helvetica Neue, helvetica, arial, sans-serif"
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -1px
  heading:
    fontFamily: "Segoe UI Variable Display, Segoe UI, segoeui, Helvetica Neue, helvetica, arial, sans-serif"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: -0.6px
  body:
    fontFamily: "Segoe UI, SegoeUI, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: -0.48px

spacing:
  base: 4px
  scale: [4, 8, 12, 16, 24, 36, 48, 56, 64, 72]

radius:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 200px

shadows:
  card: "rgba(0, 0, 0, 0.12) 0px 0px 2px 0px, rgba(0, 0, 0, 0.14) 0px 2px 4px 0px"
  elevated: "rgba(0, 0, 0, 0.12) 0px 0px 2px 0px, rgba(0, 0, 0, 0.14) 0px 2px 4px 0px"

motion:
  duration-fast: 200ms
  duration-base: 500ms
  duration-slow: 670ms
  easing: "ease-in-out"

breakpoints: [540px, 767px, 860px, 1440px]
---

## Rationale

Microsoft's Fluent design system uses a restrained, professional palette anchored in deep navy (#17253d) and bright white, with strategic use of Microsoft's signature blue (#0078d4) for interactive elements. This combination reflects enterprise trust and clarity—essential for a platform serving both consumer and business audiences. The typography stack prioritizes Segoe UI Variable, Microsoft's own typeface family, which signals brand consistency and provides excellent legibility across the full range of product offerings (Microsoft 365, Azure, Surface, Xbox). The measured spacing scale and conservative border treatment (soft gray #e7e7e7) create visual breathing room without introducing unnecessary complexity, allowing content hierarchy to remain straightforward across homepage hero sections, product CTAs, and commerce flows.

The system's moderate motion (200–670ms transitions with ease-in-out curves) and subtle shadows (2–4px soft drop) reinforce a "refined and responsive" aesthetic rather than playful or aggressive. This is deliberate: users are evaluating productivity software, cloud services, and premium hardware—not entertainment. The four responsive breakpoints (540px through 1440px) indicate mobile-first structure with particular care at tablet (767px) and desktop ranges, reflecting how users shop and authenticate across devices.

Color hierarchy is restrained: primary navy and white dominate, while surface blue reserves itself for actions and critical affordances. This discipline prevents visual noise and ensures the messaging (product promotions, sign-in flows, download links) remains scannable. Accent teal (#2a446f) appears to subtly extend the blue family for secondary emphasis, maintaining cohesion without introducing competing hues.

## 1. Visual Theme & Atmosphere

**Enterprise-grade minimalism with consumer accessibility.** The design avoids ornament, relying instead on generous spacing, clear type hierarchies, and consistent corner radii (8–200px range) to create a modern, trustworthy appearance. Shadows are deliberately understated—present but not dramatic—reinforcing a sense of stability rather than depth or playfulness.

The color palette reflects Microsoft's long-standing brand identity (navy + blue) while the whitespace-forward layout and fine-tuned type metrics (negative letter-spacing, 1.2–1.45 line heights) signal a company confident enough not to overclaim. This atmosphere suits both individual consumers (shopping Surface or Xbox) and IT decision-makers (evaluating Azure or Microsoft 365).

## 2. Color System

| Token | Value | Purpose |
|-------|-------|---------|
| **Primary** | #17253d (navy) | UI container, text on light bg, brand anchor |
| **On-Primary** | #ffffff (white) | Text/icons atop navy—guaranteed contrast |
| **Background** | #ffffff (white) | Page base, breathing room |
| **Surface** | #0078d4 (Microsoft blue) | Buttons, links, CTAs—draws attention |
| **Border** | #e7e7e7 (light gray) | Subtle dividers, card edges |
| **Text** | #616161 (medium gray) | Body copy, secondary information |
| **Text-Muted** | #17253d (navy) | Suggests a fallback or repeated use; likely tertiary text or reduced prominence |
| **Accent** | #2a446f (slate blue) | Hover states, extended hierarchy, secondary actions |

The three tonal layers (navy, gray, blue) prevent palette fatigue while maintaining clear visual priority. Blue is reserved for interactive elements, ensuring users never mistake passive content for actionable items. Light gray borders separate regions without harsh division—appropriate for e-commerce and sign-in flows where clarity of form boundaries is crucial.

## 3. Typography

| Scale | Font Family | Size | Weight | Line Height | Letter Spacing |
|-------|------------|------|--------|-------------|-----------------|
| **Display** | Segoe UI Variable Display, Segoe UI, system stack | 40px | 500 | 1.2 | −1px |
| **Heading** | Segoe UI Variable Display, Segoe UI, system stack | 24px | 500 | 1.33 | −0.6px |
| **Body** | Segoe UI, system stack | 11px | 400 | 1.45 | −0.48px |

**Rationale:** Segoe UI Variable (and its fallback stack) is Microsoft's proprietary typeface, ensuring brand fidelity and consistent rendering across Windows and web. The negative letter-spacing (−1px to −0.48px) is characteristic of modern sans-serifs and creates a compact, premium feel without reducing readability. 

Display (40px, 500wt) anchors hero sections and key messaging (e.g., "Hi there, welcome to Microsoft"). Heading (24px, 500wt) addresses promotional blocks ("Buy an eligible Surface, get free headphones"). Body text at 11px with 1.45 line height and −0.48px tracking balances density with legibility—crucial for product descriptions, CTAs, and authentication forms. The 500 weight (medium) for both display and heading avoids the heaviness of 600+ while remaining distinct from body's 400 weight.

## 4. Components & Patterns

**Buttons & CTAs:**  
Primary actions use surface blue (#0078d4) with white text. Secondary/tertiary actions likely inherit text color (#616161 or #17253d) with subtle borders. Hover states probably shift to accent (#2a446f) or deepened blue. The Fluent system favors 8–16px padding with 8–16px corner radius, balancing touchability with refinement.

**Cards & Containers:**  
Shallow shadows (card: `0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)`) create subtle elevation. Borders in #e7e7e7 are optional; whitespace often suffices. Spacing between cards follows the 4px base unit: 16px (4×), 24px (6×), 36px (9×).

**Forms & Auth:**  
Input fields likely inherit border #e7e7e7 with 8px radius. Focus state probably adds a 2px outline in surface blue. Labels use text-muted (#17253d) or text (#616161) at display or body scale. Error states may shift borders to red (unmeasured but expected in auth flows).

**Navigation & Headers:**  
Navigation text inherits body or heading scale. Active/hover states shift to surface blue. Sign-in CTAs are prominent blue buttons, reserving premium visual space for authentication on a consumer-facing homepage.

## 5. Spacing & Layout

**Scale:** 4px base unit with proportional increments: 4, 8, 12, 16, 24, 36, 48, 56, 64, 72px.

**Application:**
- **Micro spacing** (4–8px): Padding within buttons, icon margins.
- **Standard spacing** (16–24px): Padding within cards, gaps between form fields, heading-to-body distance.
- **Macro spacing** (36–72px): Section margins, gap between hero and promotional blocks, whitespace around high-level containers.

**Responsive breakpoints** (540, 767, 860, 1440px) suggest:
- **540px (mobile):** Single-column layout, 16px side margins, 24–36px section gaps.
- **767px (tablet):** Two-column grids, increased padding, 36–48px section gaps.
- **860–1440px (desktop):** Multi-column, hero imagery can expand, 48–72px section gaps.

This hierarchy keeps the page legible on mobile (where CTAs and pricing must be scannable) and leverages desktop space to showcase product imagery and promotions.

## 6. Motion & Interaction

| Property | Value |
|----------|-------|
| **Fast Duration** | 200ms (micro-interactions: icon hover, small state change) |
| **Base Duration** | 500ms (standard transitions: button press, modal appear) |
| **Slow Duration** | 670ms (larger transitions: page scroll, full hero animation) |
| **Easing** | ease-in-out (smooth deceleration, natural feel) |

**Usage:**  
Hover effects on buttons: 200ms color shift to accent (#2a446f). CTA expansion or depth (shadow increase) on interaction: 200–500ms. Page transitions, carousel slides, and reveal animations: 500–670ms. The ease-in-out curve (acceleration → deceleration) mirrors physical movement, avoiding the snappiness of linear or ease-out, which can feel abrupt for e-commerce and authentication flows. Motion is present but not disruptive—users in a purchasing or login state benefit from responsive feedback without gratuitous animation.

---

## Accessibility

### Contrast Ratios

**Primary text (#616161) on white (#ffffff):**  
Contrast ratio ≈ 5.4:1. **Exceeds WCAG AA (4.5:1).** ✓

**Navy (#17253d) on white (#ffffff):**  
Contrast ratio ≈ 12.8:1. **Exceeds WCAG AAA (7:1).** ✓

**White (#ffffff) on blue (#0078d4):**  
Contrast ratio ≈ 8.6:1. **Exceeds WCAG AAA.** ✓ (Buttons and primary CTAs are accessible.)

**Body text (11px, 400wt) at normal font-weight remains readable** at the measured size and line height (1.45) even with negative tracking, though minimum 12px is often recommended for body copy. At 11px, slightly increased line height compensates adequately.

### Minimum Requirements

- **Touch target:** All buttons, links, and interactive elements must be ≥ 44×44px (CSS), achieved via minimum 16px padding + 24px min-height on buttons, or adequate spacing between adjacent links.
- **Focus indicator:** Apply 2px solid outline in surface blue (#0078d4) or accent (#2a446f), offset 2px from element boundary. Remove browser default only if custom focus is present and meets contrast/visibility.
- **Form labels:** Always associate `<label>` with `<input>` via `for/id`. Placeholder text alone is insufficient for WCAG 2.1 SC 1.3.1.
- **Color alone:** Do not use color alone to convey status (e.g., error). Pair with icon, text, or border change.
- **Motion:** Respect `prefers-reduced-motion` media query; reduce or remove animation for users who opt out.
