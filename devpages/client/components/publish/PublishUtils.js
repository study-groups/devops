/**
 * Utility functions for publish modal
 */

export function findEditor() {
  const selectors = [
    '#md-editor textarea',
    '#editor-container textarea',
    'textarea.markdown-editor',
    'textarea#editor',
    'textarea'
  ];

  for (const selector of selectors) {
    const editor = document.querySelector(selector);
    if (editor) return editor;
  }
  return null;
}

export function ghostValue(value, length = 8) {
  if (!value || value === 'Not Set') return 'Not Set';
  return value.substring(0, 3) + '•'.repeat(Math.max(0, length - 6)) + value.substring(Math.max(3, value.length - 3));
} 