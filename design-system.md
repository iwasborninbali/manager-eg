# Modern Design System Documentation

## Overview

This document outlines our modern design system built with Tailwind CSS and React. It follows the latest design trends of 2025, emphasizing clean interfaces, user-friendly components, and a cohesive visual language.

## Color Palette

Our color system uses semantic, accessible color scales with consistent naming conventions.

### Primary Colors (Teal)

A fresh, modern teal palette that conveys trust and innovation:

| Name | Hex | Usage |
|------|-----|-------|
| primary-50 | #E6F7F7 | Subtle backgrounds, hover states |
| primary-100 | #C2EEEF | Light backgrounds, disabled states |
| primary-200 | #9DE4E6 | Borders, dividers |
| primary-300 | #6ED9DD | Icons, secondary UI elements |
| primary-400 | #3ECFD4 | Hover states for primary elements |
| primary-500 | #23B5BA | Primary buttons, active states, links |
| primary-600 | #1A8D92 | Button hover states |
| primary-700 | #14676A | Focus states, text on light backgrounds |
| primary-800 | #0E4143 | Headings on light backgrounds |
| primary-900 | #072121 | Primary text on light backgrounds |

### Secondary Colors (Amber)

A warm amber palette for contrast and visual hierarchy:

| Name | Hex | Usage |
|------|-----|-------|
| secondary-50 | #FFF8E6 | Subtle backgrounds, hover states |
| secondary-100 | #FFEBCC | Light backgrounds, disabled states |
| secondary-200 | #FFD999 | Borders, decorative elements |
| secondary-300 | #FFC866 | Secondary UI elements |
| secondary-400 | #FFB633 | Hover states for secondary elements |
| secondary-500 | #FF9F00 | Secondary buttons, highlights, accents |
| secondary-600 | #CC7F00 | Button hover states |
| secondary-700 | #995F00 | Focus states, text on light backgrounds |
| secondary-800 | #664000 | Decorative elements |
| secondary-900 | #332000 | Emphasis elements |

### Neutral Colors

Modern gray scale with a slight blue undertone for depth:

| Name | Hex | Usage |
|------|-----|-------|
| neutral-50 | #F7F9FA | Page backgrounds (light mode) |
| neutral-100 | #EEF1F4 | Card backgrounds, alternate row colors |
| neutral-200 | #DEE3E8 | Borders, dividers, inputs |
| neutral-300 | #C2CAD1 | Disabled text, icons |
| neutral-400 | #A4B0BC | Placeholder text |
| neutral-500 | #8696A7 | Secondary text |
| neutral-600 | #677A8F | Primary text in light mode |
| neutral-700 | #516173 | Emphasis text, headings |
| neutral-800 | #3A4754 | Card backgrounds (dark mode) |
| neutral-900 | #212A36 | Page backgrounds (dark mode) |
| neutral-950 | #121820 | Emphasis backgrounds (dark mode) |

### Semantic Colors

Clear, consistent status indicators:

| Type | Base (500) | Light (50) | Dark (700) |
|------|------------|------------|------------|
| Success | #22C55E | #E8F7ED | #15803D |
| Warning | #F59E0B | #FEF5E7 | #B45309 |
| Error | #EF4444 | #FEE7E7 | #B91C1C |
| Info | #3B82F6 | #EFF6FF | #1D4ED8 |

## Typography

We use Geist Sans as our primary font, with Geist Mono for code and monospaced content.

### Font Families

```css
font-family: {
  sans: ['var(--font-geist-sans)', 'sans-serif'],
  mono: ['var(--font-geist-mono)', 'monospace'],
}
```

### Text Styles

| Class | Description | Tailwind Classes |
|-------|-------------|------------------|
| heading-1 | Large titles | text-4xl sm:text-5xl font-bold tracking-tight |
| heading-2 | Section headers | text-3xl sm:text-4xl font-bold tracking-tight |
| heading-3 | Subsection headers | text-2xl sm:text-3xl font-bold tracking-tight |
| text-body | Body text | text-base leading-7 |

## Components

### Buttons

Modern, accessible buttons with various variants and states.

| Variant | Purpose | Example Classes |
|---------|---------|----------------|
| default (primary) | Primary actions | bg-primary-500 text-white hover:bg-primary-600 |
| secondary | Secondary actions | bg-secondary-500 text-white hover:bg-secondary-600 |
| outline | Less prominent actions | border border-neutral-200 bg-transparent hover:bg-neutral-100 |
| ghost | Minimal visual prominence | bg-transparent hover:bg-neutral-100 |
| destructive | Dangerous/delete actions | bg-error-500 text-white hover:bg-error-600 |

Buttons support:
- Multiple sizes (sm, md, lg, icon)
- Loading states
- Left/right icons
- Disabled states

### Cards

Flexible container components for grouping related content.

| Variant | Purpose | Example Classes |
|---------|---------|----------------|
| default | Standard card with shadow | bg-white border border-neutral-100 shadow-md |
| glass | Modern frosted glass effect | bg-white/70 backdrop-blur-md shadow-glass |
| outline | Simple outline with no shadow | bg-transparent border border-neutral-200 |
| flat | Flat card with colored background | bg-neutral-50 border-0 |

Cards come with:
- Header, content, and footer sections
- Title and description components
- Rounded corner options

### Inputs

Form controls with consistent styling and states.

Features:
- Label support
- Left/right elements (icons, buttons)
- Error states with messages
- Helper text
- Disabled states

### Badges

Compact labels for status, categories, or counts.

| Variant | Purpose | Example Classes |
|---------|---------|----------------|
| default | Primary information | bg-primary-100 text-primary-700 |
| secondary | Secondary information | bg-secondary-100 text-secondary-700 |
| success | Positive status | bg-success-100 text-success-700 |
| warning | Cautionary status | bg-warning-100 text-warning-700 |
| error | Error or critical status | bg-error-100 text-error-700 |
| outline | Subtle badge | border border-neutral-200 text-neutral-700 |

Badges support:
- Multiple sizes
- Optional status dot indicator

## Spacing

Our spacing scale extends Tailwind's default scale with additional values:

```css
spacing: {
  '4.5': '1.125rem',
  '13': '3.25rem',
  '15': '3.75rem',
  '18': '4.5rem',
  '26': '6.5rem',
  '30': '7.5rem',
}
```

## Animations

Custom animations for enhanced user experience:

| Name | Effect | Usage |
|------|--------|-------|
| fade-in | Smooth opacity transition | Page/component entry |
| slide-up | Upward movement with fade | Cards, modals, notifications |
| pulse-slow | Subtle pulsing effect | Loading indicators, highlights |

## Utilities

### Container

```css
.container-custom {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
}
```

### Text Effects

```css
.text-gradient {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500;
}

.text-balance {
  text-wrap: balance;
}
```

### Glass Effect

```css
.glass-effect {
  @apply backdrop-blur-md bg-white/70 dark:bg-neutral-900/70;
}
```

## Dark Mode Support

The design system fully supports dark mode with appropriate color adjustments:

- Light backgrounds become dark neutrals
- Text colors invert for readability
- Accent colors adjust saturation and brightness
- Border colors darken for proper contrast

## Best Practices

1. **Consistency**: Use the provided components and utility classes instead of custom styles
2. **Accessibility**: Maintain contrast ratios, focus states, and semantic HTML
3. **Responsive Design**: Use the responsive variants of classes for different screen sizes
4. **Performance**: Keep animations subtle and performant
5. **Dark Mode**: Always test both light and dark modes when implementing new UI

## Implementation Notes

- The design system is built on Tailwind CSS v4
- React components use TypeScript for type safety
- Components support composition and extension through props
- All interactive elements have proper keyboard navigation and focus handling 