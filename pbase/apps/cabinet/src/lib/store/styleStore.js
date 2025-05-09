  // src/lib/store/styleStore.js
  import { writable } from 'svelte/store';

  export const currentStyle = writable('default');

  export function setStyle(styleName) {
    currentStyle.set(styleName);
  }
