# Belief Game Capstone (room FE)

Vite + React frontend for the Belief Game Capstone room.

## Play (class demo)

Stable room link, GitHub Pages (project site, prefix stays on):

https://vannessa200345-ops.github.io/belief-game-capstone/r/ROOMCODE

Replace `ROOMCODE` with the code on the host desk. The host can also copy the full join link. Deep links work because the Pages build copies `index.html` to `404.html`.

Vercel builds the same app with `base: '/'` (the `VERCEL` env is set by Vercel, not by Pages). `vercel.json` rewrites every path that is not a real file to `index.html`, so this works on the Vercel host:

`https://<your-vercel-domain>/r/ROOMCODE`

Pages and Vercel are separate deploy settings. Do not point the Pages site at `/r/ROOMCODE` without the `/belief-game-capstone` prefix.

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
3. Model answers live in `src/host/core-key.json`, `src/host/money-key.json`, and `src/host/relationship-key.json` (`yes` / `no`). They are not copied into the student-facing public deck JSON. When the host starts self-paced, `hostDeckPayload` loads the key for that deck.
4. 金錢信念套 and 伴侶信念 show `public/cards/money` and `public/cards/relationship`, and they score, bar, and rank like core once the host starts.
5. The in-room leaderboard (this session only) is on the play screen, the final screen, and the host console. It ranks by how many answers match the model key. It does not show the key or which way someone answered.
6. While the room is playing, each card has a bar: matched grows upward, differed grows downward. Click a bar to see which card it is. The host console shows the full chart. Local mock updates as soon as someone answers. On Supabase, your own answer updates immediately; other people update when `card_events` realtime fires, otherwise on the existing room refresh (about every 4 seconds). The chart shows counts only, not the answer key.
7. Each new room shuffles card order from the room code, so everyone in that room sees the same order. A new room gets a new shuffle.
8. There is no login. The in-session rank does not become a lifetime board. Reports use only choices and times from this room. Time spent is analysis only.
