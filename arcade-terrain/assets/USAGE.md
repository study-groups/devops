# Asset Usage Guide

## SVG Logo

### Option 1: Inline SVG definitions (recommended)
Include `svg-defs.svg` content in your HTML `<body>`:

```html
<body>
  <!-- Include at top of body -->
  <svg width="0" height="0" style="position: absolute;">
    <defs>
      <g id="svg_arcade_logo">...</g>
    </defs>
  </svg>

  <!-- Use anywhere -->
  <svg class="logo" viewBox="0 0 252 52">
    <use href="#svg_arcade_logo" fill="currentColor"/>
  </svg>
</body>
```

### Option 2: External reference
```html
<svg class="logo" viewBox="0 0 252 52">
  <use href="assets/svg-defs.svg#svg_arcade_logo" fill="currentColor"/>
</svg>
```

## Fonts

Include in your CSS:
```css
@import url('assets/fonts.css');

body {
  font-family: var(--font-body);
}
h1, h2, h3 {
  font-family: var(--font-display);
}
```

Or link in HTML:
```html
<link rel="stylesheet" href="assets/fonts.css">
```

## Themes

Include the simplified theme CSS:
```html
<link rel="stylesheet" href="assets/simple-theme.css">
```

Set theme on `<html>`:
```html
<html data-theme="lava">  <!-- lava, tv, lcd, cyber -->
```

Switch themes with JavaScript:
```javascript
document.documentElement.dataset.theme = 'tv';
```

## CSS Variables

All themes provide these variables:
- `--ink` - Primary text color
- `--one` through `--four` - Accent colors
- `--paper-light`, `--paper-mid`, `--paper-dark` - Surface colors
- `--shade` - Darkest background
- `--font-display` - PJ43 display font
- `--font-body` - AG body font
- `--font-mono` - Space Mono code font
