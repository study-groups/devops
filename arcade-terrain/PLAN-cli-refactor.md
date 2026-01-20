# Plan: NoiseCard CLI UI Refactor

## Goals

1. **Simplify CLI output** - Don't generate values, just confirm settings
   - Before: `> direction left` → (generates output)
   - After: `> direction left` → `direction = left`

2. **Last control in header** - Most recently used slider/button appears in header area

3. **Restyle layer buttons** - Tighter layout, slider below buttons

4. **Single line history** - Only show one line of history above CLI input

5. **Reserve space below CLI** - For tab completion buttons and dynamic inline forms

6. **Expandable parameter pills** - Clicking a parameter (e.g., `direction=left`) opens inline form control

## Current Architecture

Key files:
- `modules/components/NoiseCard/NoiseCLI.js` - Command parsing, output logging
- `modules/components/NoiseCard/SliderManager.js` - Inline slider lifecycle
- `modules/components/NoiseCard/cli-commands.js` - Command metadata
- `modules/components/NoiseCard/index.js` - Main NoiseCard component
- `styles/components/noise-card.css` - All CLI styling

## Target Layout

```
┌─────────────────────────────────────────┐
│ NoiseCard   [1][2][3]   [direction=↓]   │  ← header with last control pill
│            [═══●═══] blend 0.5          │  ← blend slider below buttons
├─────────────────────────────────────────┤
│ direction = down                        │  ← single line history
├─────────────────────────────────────────┤
│ 1> _                                    │  ← CLI input
│                                         │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │  ← tab completion area
│ │type │ │ ca  │ │style│ │preset│        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│                                         │
│ [expanded pill form when clicked]       │  ← dynamic form area
└─────────────────────────────────────────┘
```

## Implementation Steps

### 1. Refactor CLI Output (NoiseCLI.js)
- Modify `_dispatch()` to return simple confirmation strings
- Format: `{param} = {value}` for all settings
- Remove verbose output generation for slider commands

### 2. Add Header Control Slot (index.js + CSS)
- Add `lastControl` container in header after layer buttons
- Render as clickable pill showing `param=value`
- Update on each command execution
- Click opens dropdown/slider inline

### 3. Restyle Header Layout (noise-card.css)
- Compact layer buttons: smaller, inline
- Move blend slider to second row below buttons
- Add flexbox layout for header control pill

### 4. Limit History Display (NoiseCLI.js)
- Change output area to show only last entry
- Or: collapse history, show expand button
- Keep full history in memory for arrow-key navigation

### 5. Add Tab Completion Area (NoiseCLI.js + CSS)
- Reserve space below input for completion buttons
- Generate buttons dynamically based on current input context
- Style as pill buttons in a flex row

### 6. Expandable Parameter Pills (new component)
- Create `ParameterPill.js` component
- States: collapsed (shows value), expanded (shows form control)
- Form types: dropdown (for enums), slider (for numbers), text input
- Click to expand, click outside to collapse

## CSS Changes Summary

```css
/* Header layout */
.noise-cli-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.noise-cli-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Last control pill */
.noise-cli-last-control {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

/* Single line history */
.noise-cli-output {
  max-height: 1.5em;
  overflow: hidden;
}

/* Tab completion area */
.noise-cli-completions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 0;
}
```

## Testing

1. Type commands, verify simple `param = value` output
2. Verify last control appears in header
3. Click header control pill, verify form expands
4. Press Tab on empty input, verify completion buttons appear
5. Verify only one history line visible
6. Test arrow keys still navigate full history

## Notes

- Keep SliderManager for inline sliders (may repurpose for expanded pills)
- Consider gesture support for pills (swipe to dismiss)
- Color code pills by category (orange=type, cyan=ca, green=style)
