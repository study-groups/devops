  <!-- src/routes/play/[game]/+page.svelte -->
  <script context="module" lang="ts">
    import type { PageLoad } from './$types';

    export const load: PageLoad = async ({ params }) => {
      const { game } = params;

      // Fetch game data based on the game parameter
      const response = await fetch(`/api/games/${game}`);
      if (!response.ok) {
        throw new Error('Game not found');
      }
      const gameData = await response.json();

      return {
        game: gameData
      };
    };
  </script>

  <script lang="ts">
    import type { PageData } from './$types';

    export let data: PageData;
  </script>

  <h1>{data.game.name}</h1>
  <p>{data.game.description}</p>

  <!-- Add game-specific components or logic here -->
