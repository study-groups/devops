  // src/routes/api/games/[id].ts
  import type { RequestHandler } from '@sveltejs/kit';

  const games = [
    { id: 'chess', name: 'Chess', description: 'A strategic board game.' },
    { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', description: 'A simple pen and paper game.' },
    // Add more games as needed
  ];

  export const GET: RequestHandler = ({ params }) => {
    const game = games.find(g => g.id === params.id);

    if (game) {
      return new Response(JSON.stringify(game), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
  };
