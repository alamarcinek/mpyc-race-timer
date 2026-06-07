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
- **Voice notes** — record audio notes during a race (works fully offline); transcribe them later via AI when back on land
- **100% offline** — all data stored locally (localStorage + IndexedDB), no backend required. Works on the water with no signal
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
| Data storage | localStorage (no backend, no account needed) |
| Audio storage | IndexedDB (voice note blobs) |
| AI vision + audio | Anthropic Claude API via Vercel serverless functions |
| Hosting | Vercel (or GitHub Pages) |

---

## Project Structure

```
api/
├── parse-signup.js     # Vercel serverless function — AI signup sheet scan
└── transcribe.js       # Vercel serverless function — AI voice note transcription
src/
├── lib/
│   └── recordings.js   # IndexedDB helpers for audio blob storage
├── stores/
│   ├── competitors.js  # Competitor CRUD backed by localStorage
│   ├── races.js        # Race + result CRUD backed by localStorage
│   └── ui.js           # Toast, confirm dialog, wake lock, save status
├── views/
│   ├── SetupView.vue   # Add competitors manually or via AI photo scan
│   ├── RaceView.vue    # Countdown, race timer, finish recording, voice notes
│   └── HistoryView.vue # Race history, CSV export, voice note playback + transcription
├── router/index.js
└── App.vue             # Shell, nav, global styles
```

### localStorage keys

| Key | Contents |
|---|---|
| `mpyc_competitors` | JSON array of competitor objects |
| `mpyc_races` | JSON array of race objects |
| `mpyc_results` | JSON array of result objects (flat, keyed by `race_id`) |

### IndexedDB

Voice note audio blobs are stored in IndexedDB (`mpyc_audio` database, `recordings` store) because localStorage cannot hold binary data. Each record contains the audio blob, duration, timestamp, optional race number, and optional transcript.

---

## Local Development

### Prerequisites

- Node 20+
- An Anthropic API key (optional — only needed for the AI photo scan feature)

### Setup

```bash
git clone https://github.com/alamarcinek/mpyc-race-timer.git
cd mpyc-race-timer
npm install
```

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...   # optional — enables AI photo scan and voice transcription
```

```bash
npm run dev
```

Open `http://localhost:5173`.

> **Note:** the photo scan (`/api/parse-signup`) and voice transcription (`/api/transcribe`) only run on Vercel. In local dev these features will return errors unless you run `vercel dev` instead of `npm run dev`.

---

## Deployment

### Vercel (recommended)

1. Fork this repo and import it into [Vercel](https://vercel.com)
2. Add one environment variable under **Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY` — your key from [console.anthropic.com](https://console.anthropic.com) (server-side only, never sent to the browser). Enable for all environments (Production, Preview, Development).
3. Deploy — `vercel.json` handles SPA routing and the `api/` folder is auto-deployed as serverless functions
4. On subsequent deploys, env var changes take effect automatically

### GitHub Pages

The included Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.

> **Note:** GitHub Pages is static — the `/api/parse-signup` serverless function won't run there. All other features (timer, history, CSV export) work fully offline with no backend.

1. Go to **Settings → Pages** and set Source to **Deploy from a branch → `gh-pages`**
2. Push any change to trigger the first deploy — app will be live at `https://your-username.github.io/mpyc-race-timer/`

---

## AI Features

Both AI features require `ANTHROPIC_API_KEY` set in Vercel. The key lives only on the server and is never sent to the browser. All other app features work fully offline without it.

### Signup sheet scan

The Setup page lets you photograph a paper signup sheet. The image is compressed client-side then sent to `/api/parse-signup`, which forwards it to the Claude vision API and returns a parsed list of competitors (name, sail number, class).

### Voice note transcription

During a race, tap the **REC** button to record audio notes (mic permission required). Notes are saved to IndexedDB and work fully offline. Back on land, open **History → Voice Notes** and tap **✦ Transcribe** on any note — it sends the audio to `/api/transcribe`, which uses Claude's audio understanding to return a transcript. The transcript is saved back to IndexedDB alongside the recording.

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
