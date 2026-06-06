# MPYC Race Timer

A mobile-first PWA for running yacht club race starts and recording finish times. Built for Mount Pleasant Yacht Club but designed to work for any club running handicap or one-design racing.

Live demo: [mpyc-race-timer.vercel.app](https://mpyc-race-timer.vercel.app)

---

## Features

- **AI signup sheet scan** — photograph a handwritten entry sheet and Claude vision parses names, sail numbers, and class automatically
- **Configurable start sequence** — 1–5 minute countdown with audio beeps and haptic feedback at each minute mark, last 5 seconds, and gun
- **Race timer** — tap RECORD FINISH for each boat in order; finish times are decoupled from the start list so you can reorder sailors freely
- **Draggable results** — drag rows during or after racing to match finish order to sailors
- **Race history** — browse saved races, view full results, export Sailwave-compatible CSV
- **Offline-first** — IndexedDB stores everything locally; Supabase syncs when online. Works on the water with no signal
- **PWA** — installable on iOS and Android, runs standalone
- **Wake lock** — screen stays on while the timer is running

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 + Composition API (`<script setup>`) |
| State | Pinia |
| Router | Vue Router 5 (history mode) |
| Build | Vite 8 |
| PWA | vite-plugin-pwa + Workbox |
| Backend | Supabase (Postgres + REST API) |
| Offline store | IndexedDB (custom wrapper, no extra deps) |
| AI vision | Anthropic Claude API (direct `fetch`, no SDK) |
| Hosting | Vercel (or GitHub Pages) |

---

## Project Structure

```
src/
├── lib/
│   ├── db.js           # IndexedDB wrapper (getAll, upsert, remove, sync queue)
│   ├── supabase.js     # Supabase client
│   └── sync.js         # Flush offline queue when back online
├── stores/
│   ├── competitors.js  # Competitor CRUD, offline-first
│   ├── races.js        # Race + result CRUD
│   └── ui.js           # Toast, confirm dialog, wake lock, save status
├── views/
│   ├── SetupView.vue   # Add competitors manually or via AI photo scan
│   ├── RaceView.vue    # Countdown, race timer, finish recording
│   └── HistoryView.vue # Race history, CSV export
├── router/index.js
└── App.vue             # Shell, nav, global styles, online sync init
supabase-schema.sql     # Run once to create tables + RLS policies
```

---

## Supabase Setup

### 1. Create a project

Go to [supabase.com](https://supabase.com), create a new project, and note your **Project URL** and **anon public key** from Settings → API.

### 2. Run the schema

Open the SQL Editor in your Supabase dashboard and paste the contents of [`supabase-schema.sql`](./supabase-schema.sql). This creates three tables:

| Table | Purpose |
|---|---|
| `competitors` | Sailor name, sail number, class |
| `races` | Race number, date, start time, sequence length |
| `race_results` | Position, elapsed seconds, DNF flag — linked to race + competitor |

RLS is enabled with open anon policies suitable for a trusted club network. Tighten these if you expose the app publicly.

---

## Local Development

### Prerequisites

- Node 20+
- A Supabase project (see above)
- An Anthropic API key (optional — only needed for photo scan)

### Setup

```bash
git clone https://github.com/alamarcinek/mpyc-race-timer.git
cd mpyc-race-timer
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ANTHROPIC_API_KEY=sk-ant-...   # optional — enables AI photo scan
```

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## Deployment

### Vercel (recommended)

1. Fork this repo and import it into [Vercel](https://vercel.com)
2. Add the three environment variables under **Settings → Environments → Production**
3. Deploy — `vercel.json` handles SPA routing automatically

### GitHub Pages

The included Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.

1. Go to **Settings → Pages** and set Source to **GitHub Actions**
2. Add the three env vars as repository secrets under **Settings → Secrets and variables → Actions**
3. Push any change to trigger the first deploy — app will be live at `https://your-username.github.io/mpyc-race-timer/`

---

## CSV Export Format

Exports use the [Sailwave](https://www.sailwave.com) import format:

```
raceno,class,sailno,HelmName,start,elapsed
1,ILCA 7,209876,John Smith,10:30:00,00:45:12
1,ILCA 6,154321,Jane Doe,10:30:00,00:47:33
```

Import into Sailwave via **File → Import → Timing system file**.

---

## How the Race Model Works

Finish times are recorded as a flat list independent of the start list. After all boats finish, drag rows in the results table to match each sailor to their finishing position. This mirrors how club racing actually works — record times as boats cross the line, then sort out who's who.

```
raceOrder[0] → finishTimes[0]   # 1st place sailor → 1st recorded time
raceOrder[1] → finishTimes[1]   # 2nd place sailor → 2nd recorded time
...
raceOrder[n] → DNF              # no finish time recorded = DNF
```

---

## Offline Behaviour

All writes go to IndexedDB first. If Supabase is reachable, the write is mirrored immediately. If not, the operation is queued in a `sync_queue` IndexedDB store and replayed automatically the next time the device comes online. Reads always come from IndexedDB — the app never blocks on a network call.

---

## Adapting for Your Club

- **Club name** — edit the header in `SetupView.vue` and the PWA `name`/`short_name` in `vite.config.js`
- **Boat classes** — update the `CLASSES` array in `SetupView.vue` and the options in the add-sailor modal in `RaceView.vue`
- **Sequence length** — adjust the `v-for` range on the sequence buttons in `RaceView.vue`
- **Beep pattern** — `tick()` in `RaceView.vue` controls when beeps fire; tweak to match your class rules

---

## Contributing

PRs welcome. The codebase is intentionally minimal — no TypeScript, no test suite, no unnecessary abstraction. Keep it that way.

1. Fork and clone
2. `npm install && npm run dev`
3. Make your change
4. `npm run lint` before opening a PR

---

## License

MIT
