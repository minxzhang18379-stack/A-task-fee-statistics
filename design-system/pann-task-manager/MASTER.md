# PANN Task Manager - Master Design System Specification

> **RETRIEVAL LOGIC:** When building or modifying a specific page, first check `design-system/pann-task-manager/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. Otherwise, follow the global rules documented here.

---

**Project:** PANN Task Manager
**Active Aesthetic:** Premium Glassmorphism (超感玻璃拟态)
**Target Core Stack:** React, Tailwind CSS, Vite, Tauri
**Version:** v1.1.2 (Bilingual Desktop Native)

---

## 🎨 Global Design Tokens

### 1. Light/Dark Glass Palette (HSL Theme Aware)

Our glassmorphism color palette uses Tailored HSL color parameters that adjust automatically between Light and Dark mode to ensure WCAG AA (4.5:1) text contrast.

| Token | Light Mode Value (HSL) | Dark Mode Value (HSL) | CSS Custom Variable | Visual Role |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `221.2 83.2% 53.3%` | `217.2 91.2% 59.8%` | `--primary` | Active tabs, focus states |
| **Background** | `0 0% 100%` | `222.2 84% 4.9%` | `--background` | Main container underglow |
| **Card Glass** | `rgba(255, 255, 255, 0.45)` | `rgba(15, 23, 42, 0.45)` | `--card` | Glassmorphic floating card panels |
| **Card Border** | `rgba(226, 232, 240, 0.6)` | `rgba(255, 255, 255, 0.08)` | `--border` | Inner glow and glass outline |
| **Glow Bubble 1** | `rgba(59, 130, 246, 0.35)` | `rgba(59, 130, 246, 0.48)` | `--glow-1` | Deep blue ambient backdrop bubble |
| **Glow Bubble 2** | `rgba(16, 185, 129, 0.30)` | `rgba(16, 185, 129, 0.42)` | `--glow-2` | Emerald green ambient backdrop bubble |
| **Glow Bubble 3** | `rgba(139, 92, 246, 0.25)` | `rgba(139, 92, 246, 0.38)` | `--glow-3` | Violet purple ambient backdrop bubble |

---

### 2. Precise Bilingual Typography

- **Heading/Numeral Font:** `'IBM Plex Sans'` (Modern sans-serif with geometric precision; ideal for technical, tabular fee digits).
- **Chinese Body Font:** `'IBM Plex Sans SC'` (Refined Simplified Chinese typeface with comfortable spacing and legibility).
- **System Fallbacks:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Google Fonts Import:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
```

---

### 3. Glassmorphic Shadow Depths & Borders

| Shadow Token | Value | Applied To |
| :--- | :--- | :--- |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.03)` | Status indicators, mini check inputs |
| `--shadow-md` | `0 8px 32px 0 rgba(15, 23, 42, 0.05)` | Regular dashboard and task list glass cards |
| `--shadow-lg` | `0 16px 48px -12px rgba(9, 15, 30, 0.15)` | Modals, dropdown context menus, interactive popups |

---

## 🏛️ Glassmorphic UI Components (CSS Definitions)

### 1. The Underlay Ambient Glow Wrapper
An elegant animated backdrop containing multi-layer radial gradients that slide in the background to bring the dashboard to life.

```css
.ambient-glow-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(243, 244, 246, 0.4) 0%, rgba(255, 255, 255, 0.8) 100%);
  z-index: 0;
}
.dark .ambient-glow-bg {
  background: radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.95) 0%, rgba(9, 15, 30, 0.98) 100%);
}

.glow-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.95;
  mix-blend-mode: multiply;
  animation: float 30s infinite alternate ease-in-out;
}
.dark .glow-circle {
  mix-blend-mode: screen;
  filter: blur(150px);
}
```

### 2. Glassmorphic Container Cards
Frosted glass panels that overlay on top of the moving ambient bubbles.

```css
.glass-card {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(15, 23, 42, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .glass-card {
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 32px -12px rgba(0, 0, 0, 0.4);
}

.glass-card:hover {
  transform: translateY(-2.5px);
  border-color: rgba(59, 130, 246, 0.3);
}
```

---

## 🚫 Style Anti-Patterns (MUST Avoid)

- ❌ **No Emojis as Icons** — Emojis like 🚀, ⚙️, 💰 are forbidden as UI icons. Use SVG sets exclusively (`lucide-react`, `lucide` or standard Heroicons).
- ❌ **No Layout-Shifting Hovers** — Interactive cards must use `translateY` or `opacity` changes; never modify margins, paddings, or scale factors that affect siblings.
- ❌ **No Deep-Contrast Colors in Light Mode** — Card borders in light mode must be translucent gray (`rgba(226,232,240,0.6)`) or slate-200. Solid black borders are forbidden on glass cards.
- ❌ **No Harsh Plain Gradients** — Gradient meshes must always be smooth and organic. Hard-coded linear-gradients (e.g. `linear-gradient(to right, red, blue)`) are forbidden on structural layouts.

---

## 📋 Pre-Delivery Validation Checklist

Before code release, verify:
- [ ] Both Light and Dark modes have been tested for WCAG AA readability.
- [ ] All clickable buttons, tags, or options have the `cursor-pointer` utility.
- [ ] Page transition classes are applied (`animate-page` with `fadeInSlideUp` animation).
- [ ] No horizontal scrolling occurs on mobile dimensions (375px wide).
- [ ] Focus rings are visible on elements during keyboard navigation (`focus-visible:ring-1`).
