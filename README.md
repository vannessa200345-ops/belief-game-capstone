# Belief Game Capstone (room FE)

Vite + React frontend for the Belief Game Capstone room.

## Play (class demo)

https://vannessa200345-ops.github.io/belief-game-capstone/

Vite `base` and the router `basename` are `/belief-game-capstone`. Room links and card images include that prefix. Deep links such as `/belief-game-capstone/r/ROOMCODE` rely on a `404.html` copy of `index.html`.

## Run

```bash
npm install
npm run dev
```

Local dev uses the same prefix: http://localhost:43123/belief-game-capstone/

## Supabase

Copy `.env.example` to `.env` and fill in the live Supabase URL and anon key locally:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not commit `.env`. The Pages workflow builds with the public anon key only. Never add a `service_role` key.

## Try the pictured decks

```bash
npm install
npm run dev
```

Without `.env`, the app uses the local mock and still grades **信念原套**.

1. Open `/host`, pick 信念原套, create a room, then start.
2. Join with the room code. Each turn shows the belief card (`public/cards/core/01.jpg` … `50.jpg`), then two Yes / No buttons. The buttons use a cropped face from the choice art (`public/choices/yes-face.jpg`, `public/choices/no-face.jpg`) and submit `yes` or `no`.
3. Model answers for core live in `src/host/core-key.json` (`yes` / `no`). They are not copied into the student-facing public deck JSON.
4. 金錢信念套 and 伴侶信念 show `public/cards/money` and `public/cards/relationship`. Their answer keys are not in the repo yet, so those decks are not scored and do not rank.
5. The in-room leaderboard (this session only) is on the play screen, the final screen, and the host console. It ranks by how many answers match the model key. It does not show the key or which way someone answered.
6. While the room is playing, each card has a soft wave: correct grows a green bar upward, wrong grows a rose bar downward. The host console shows the full chart. Local mock updates as soon as someone answers. On Supabase, your own answer updates immediately; other people update when `card_events` realtime fires, otherwise on the existing room refresh (about every 4 seconds). The chart shows counts only, not the answer key.
