/**
 * DesignInspector Configuration
 * Schema definitions and constants
 */

export const STORAGE_KEY = 'pja-design-overrides';

// CSS variable tokens for color selection
export const COLOR_TOKENS = [
  { value: 'var(--ink)', label: '--ink (Text)' },
  { value: 'var(--one)', label: '--one (Primary)' },
  { value: 'var(--two)', label: '--two (Secondary)' },
  { value: 'var(--three)', label: '--three (Accent)' },
  { value: 'var(--four)', label: '--four (Success)' },
  { value: 'var(--shade)', label: '--shade (Dark)' },
  { value: 'var(--paper-light)', label: '--paper-light' },
  { value: 'var(--paper-mid)', label: '--paper-mid' },
  { value: 'var(--paper-dark)', label: '--paper-dark' },
  { value: 'var(--color-background)', label: '--color-background' },
  { value: 'var(--color-text)', label: '--color-text' },
  { value: 'var(--color-text-muted)', label: '--color-text-muted' },
  { value: 'inherit', label: 'inherit' },
  { value: 'transparent', label: 'transparent' },
];

// Property definitions organized by category
// scope: 'global' = saved for all themes, 'theme' = saved per theme
export const PROPERTY_SCHEMA = {
  box: {
    title: 'Box Model',
    scope: 'global',
    properties: [
      { name: 'dimensions', label: 'Size', type: 'grid', fields: [
        { name: 'width', label: 'W', placeholder: 'auto' },
        { name: 'height', label: 'H', placeholder: 'auto' },
        { name: 'min-width', label: 'Min W', placeholder: '0' },
        { name: 'min-height', label: 'Min H', placeholder: '0' },
      ]},
      { name: 'max-dimensions', label: 'Max', type: 'grid', fields: [
        { name: 'max-width', label: 'Max W', placeholder: 'none' },
        { name: 'max-height', label: 'Max H', placeholder: 'none' },
      ]},
    ]
  },
  spacing: {
    title: 'Spacing',
    scope: 'global',
    layout: 'quad',
    properties: [
      { name: 'margin', label: 'Margin', type: 'quad', sides: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
      { name: 'padding', label: 'Padding', type: 'quad', sides: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
    ]
  },
  position: {
    title: 'Position',
    scope: 'global',
    properties: [
      { name: 'position', label: 'Position', type: 'select', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { name: 'inset', label: 'Inset', type: 'quad', sides: ['top', 'right', 'bottom', 'left'] },
      { name: 'z-index', label: 'Z-Index', type: 'text', placeholder: 'auto' },
    ]
  },
  colors: {
    title: 'Colors',
    scope: 'theme',
    properties: [
      { name: 'color', label: 'Text', type: 'token' },
      { name: 'background-color', label: 'Background', type: 'token' },
      { name: 'border-color', label: 'Border', type: 'token' },
    ]
  },
  typography: {
    title: 'Typography',
    scope: 'global',
    properties: [
      { name: 'font-family', label: 'Font', type: 'text', placeholder: 'inherit' },
      { name: 'font-size', label: 'Size', type: 'text', placeholder: '1rem' },
      { name: 'font-weight', label: 'Weight', type: 'text', placeholder: 'normal' },
      { name: 'line-height', label: 'Line H', type: 'text', placeholder: 'normal' },
      { name: 'letter-spacing', label: 'Spacing', type: 'text', placeholder: 'normal' },
      { name: 'text-align', label: 'Align', type: 'select', options: ['left', 'center', 'right', 'justify'] },
    ]
  },
  border: {
    title: 'Border',
    scope: 'global',
    properties: [
      { name: 'border-width', label: 'Width', type: 'text', placeholder: '0' },
      { name: 'border-style', label: 'Style', type: 'select', options: ['none', 'solid', 'dashed', 'dotted', 'double'] },
      { name: 'border-radius', label: 'Radius', type: 'text', placeholder: '0' },
      { name: 'box-shadow', label: 'Shadow', type: 'text', placeholder: 'none' },
      { name: 'outline', label: 'Outline', type: 'text', placeholder: 'none' },
    ]
  },
  flexContainer: {
    title: 'Flex Container',
    scope: 'global',
    properties: [
      { name: 'display', label: 'Display', type: 'select', options: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none'] },
      { name: 'flex-direction', label: 'Direction', type: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
      { name: 'flex-wrap', label: 'Wrap', type: 'select', options: ['nowrap', 'wrap', 'wrap-reverse'] },
      { name: 'justify-content', label: 'Justify', type: 'select', options: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'] },
      { name: 'align-items', label: 'Align Items', type: 'select', options: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'] },
      { name: 'align-content', label: 'Align Content', type: 'select', options: ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'] },
      { name: 'gap', label: 'Gap', type: 'text', placeholder: '0' },
      { name: 'row-gap', label: 'Row Gap', type: 'text', placeholder: '0' },
      { name: 'column-gap', label: 'Col Gap', type: 'text', placeholder: '0' },
    ]
  },
  flexItem: {
    title: 'Flex Item',
    scope: 'global',
    collapsed: true,
    properties: [
      { name: 'flex-grow', label: 'Grow', type: 'text', placeholder: '0' },
      { name: 'flex-shrink', label: 'Shrink', type: 'text', placeholder: '1' },
      { name: 'flex-basis', label: 'Basis', type: 'text', placeholder: 'auto' },
      { name: 'align-self', label: 'Align Self', type: 'select', options: ['auto', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline'] },
      { name: 'order', label: 'Order', type: 'text', placeholder: '0' },
    ]
  },
  overflow: {
    title: 'Overflow',
    scope: 'global',
    properties: [
      { name: 'overflow', label: 'Overflow', type: 'select', options: ['visible', 'hidden', 'scroll', 'auto', 'clip'] },
      { name: 'overflow-x', label: 'Overflow X', type: 'select', options: ['visible', 'hidden', 'scroll', 'auto', 'clip'] },
      { name: 'overflow-y', label: 'Overflow Y', type: 'select', options: ['visible', 'hidden', 'scroll', 'auto', 'clip'] },
      { name: 'text-overflow', label: 'Text Overflow', type: 'select', options: ['clip', 'ellipsis'] },
      { name: 'white-space', label: 'White Space', type: 'select', options: ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'] },
    ]
  },
  visibility: {
    title: 'Visibility',
    scope: 'global',
    collapsed: true,
    properties: [
      { name: 'visibility', label: 'Visibility', type: 'select', options: ['visible', 'hidden', 'collapse'] },
      { name: 'opacity', label: 'Opacity', type: 'text', placeholder: '1' },
      { name: 'pointer-events', label: 'Pointer', type: 'select', options: ['auto', 'none'] },
      { name: 'clip-path', label: 'Clip Path', type: 'text', placeholder: 'none' },
    ]
  },
  grid: {
    title: 'Grid',
    scope: 'global',
    collapsed: true,
    properties: [
      { name: 'grid-template-columns', label: 'Columns', type: 'text', placeholder: 'none' },
      { name: 'grid-template-rows', label: 'Rows', type: 'text', placeholder: 'none' },
      { name: 'grid-column', label: 'Col Span', type: 'text', placeholder: 'auto' },
      { name: 'grid-row', label: 'Row Span', type: 'text', placeholder: 'auto' },
      { name: 'place-items', label: 'Place Items', type: 'text', placeholder: 'stretch' },
      { name: 'place-content', label: 'Place Content', type: 'text', placeholder: 'stretch' },
    ]
  }
};

// Empty overrides structure
export function createEmptyOverrides() {
  return { global: {}, themes: {}, selectorMap: {} };
}
