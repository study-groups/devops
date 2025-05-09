  <script context="module" lang="ts">
    // src/routes/play/[game]/+layout.svelte
    import { pjaStyleSdk } from '$lib/pjaStyleSdk';
    import { currentStyle, setStyle } from '$lib/store/styleStore';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';

    let style;

    const unsubscribe = currentStyle.subscribe(value => {
      style = value;
      pjaStyleSdk.applyStyle(style);
    });

    onMount(() => {
      // Clean up the subscription when the component is destroyed
      return () => unsubscribe();
    });
  </script>

  <slot />



   <script lang="ts">
     import type { PageData } from './$types';
     import Chess from '$lib/components/games/Chess.svelte';
     import TicTacToe from '$lib/components/games/TicTacToe.svelte';

     export let data: PageData;

     let GameComponent;

     // Dynamically assign the component based on the game ID
     $: {
       switch (data.game.id) {
         case 'chess':
           GameComponent = Chess;
           break;
         case 'tic-tac-toe':
           GameComponent = TicTacToe;
           break;
         default:
           GameComponent = null;
       }
     }
   </script>

   <h1>{data.game.name}</h1>
   <p>{data.game.description}</p>

   {#if GameComponent}
     <svelte:component this={GameComponent} />
   {:else}
     <p>Game not available.</p>
   {/if}
