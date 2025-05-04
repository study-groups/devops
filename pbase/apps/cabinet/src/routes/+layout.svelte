   <!-- src/routes/+layout.svelte -->
   <script>
     import { setStyle } from '$lib/store/styleStore';

     function changeStyle(newStyle) {
       setStyle(newStyle);
     }
   </script>

   <header>
     <button on:click={() => changeStyle('dark')}>Dark Theme</button>
     <button on:click={() => changeStyle('light')}>Light Theme</button>
     <!-- Add more style options as needed -->
   </header>

   <slot />
   ```
