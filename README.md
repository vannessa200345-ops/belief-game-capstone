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

## Host password and bookings

Apply `supabase/migrations/20261108150000_host_pin_and_bookings.sql` in the Supabase SQL editor, then reload the API schema cache. This frontend cannot change the live database by itself.

`/host` asks for a six-digit password before the host controls. The check is a security-definer database function. The platform operator credential is seeded as a bcrypt hash only. Do not put that PIN in `VITE_` environment variables or in frontend source.

A renter sets a different password for their own session at `/host/setup`, using a one-time claim code from the schedule. Players still join `/r/ROOMCODE` with no password.

`/book` lists group slots and one-on-one teachers. The host chooses a slot capacity from 1 to 30. This migration does not change `rooms.max_players` and does not remove the technical room cap.

After the host password is accepted, the console and `/host/analytics` stay available during play. Live scoring shows the match rate, people present, and how many cards already have a checked answer. Totals still come only from checked choices in this session. The host and demo learners are not scored. A projector control only enlarges that panel.

Public pages use a top bar, not a sidebar: `/about`, `/courses`, `/book`, and the enter-room screen. `/` and `/r/ROOMCODE` stay a room-code form, with only a slim top bar. The host desk keeps its own links and does not use that marketing bar.

`/book` is a separate page from the game enter screen at `/` and `/r/ROOMCODE`. The enter screen only takes a room code and a name. Booking is not shown there.

`/book` starts with two services: a group session marked 隨緣樂助 (give as you wish, no advance payment, host-set capacity, at most 30) and a one-on-one of about one hour at HKD 800. The page registers the time and does not take payment. Andy (Theta Healing) can be chosen. Vanessa (Quantum healing, certified quantum practitioner) can be chosen too. Apply `20261108160000_teacher_bookable_on_board.sql`, then `20261108170000_teacher_modalities.sql` and `20261108180000_vanessa_bookable.sql`, so production lists both as bookable.

Andy and Vanessa are both bookable for one-on-one. Group sessions are give as you wish, and the booking flow does not require payment first.

## Try the pictured decks

```bash
npm install
npm run dev
```

Without `.env`, the app uses the local mock and still grades **信念原套**.

1. Open `/host`, pick 信念原套, create a room, then start.
2. Students open the host’s link (`/r/ROOMCODE`). The code comes from the link. **進入房間** leads to a name screen. Bare `/` is a short game entry with the same button; pasting a link is a small optional control, not a help page. Each turn shows the belief card (`public/cards/core/01.jpg` … `50.jpg`), then two Yes / No buttons. The buttons use a cropped face from the choice art (`public/choices/yes-face.jpg`, `public/choices/no-face.jpg`) and submit `yes` or `no`.
3. Model answers live in `src/host/core-key.json`, `src/host/money-key.json`, and `src/host/relationship-key.json` (`yes` / `no`). They are not copied into the student-facing public deck JSON. When the host presses Start answering, `hostDeckPayload` loads the key for that deck.
4. 金錢信念套 and 伴侶信念 show `public/cards/money` and `public/cards/relationship`, and they score, bar, and rank like core once the host starts.
5. The in-room leaderboard (this session only) is on the play screen, the final screen, and the host console. It ranks by how many answers match the model key. It does not show the key or which way someone answered.
6. While the room is playing, each card has a bar: matched grows upward, differed grows downward. Click a bar to see which card it is. The host console shows the full chart. Local mock updates as soon as someone answers. On Supabase, your own answer updates immediately; other people update when `card_events` realtime fires, otherwise on the existing room refresh (about every 4 seconds). The chart shows counts only, not the answer key.
7. Each new room shuffles card order from the room code, so everyone in that room sees the same order. A new room gets a new shuffle.
8. There is no login. The in-session rank does not become a lifetime board. Reports use only choices and times from this room. Time spent is analysis only.
