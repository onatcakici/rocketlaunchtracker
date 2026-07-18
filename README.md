# 🚀 Rocket Launch Tracker

**rocketlaunchtracker.com** — live countdown, schedule and calendar for every upcoming rocket launch worldwide.

Static site, zero build step, free hosting on GitHub Pages. Launch data streams from [Launch Library 2](https://thespacedevs.com/llapi) by The Space Devs and is auto-refreshed every 6 hours by a GitHub Action.

![screenshot](docs/screenshot.png)

## Features

- **T‑minus hero countdown** to the very next liftoff, with webcast link
- **List view** — filterable cards (provider, status, free-text search) with per-launch mini countdowns
- **Calendar view** — real month grid, launches on their dates, in *your* timezone
- **Mission popups** — description, pad + map, weather-go probability, window, webcasts, one‑click **Add to Google Calendar**
- **"Reading the board"** — explains Go/TBC/TBD, NET and T‑minus for newcomers
- No frameworks, one HTML/CSS/JS page, loads fast, works on phones

## How the data flows

```
The Space Devs LL2 API ──(GitHub Action, every 6h)──▶ data/launches.json ──▶ your visitors
                        └─(live fallback: browser fetches API directly if the cache is stale/missing)
```

The committed `data/launches.json` starts as **sample data** (marked `"sample": true`). The moment the site is opened it pulls live data, and the first Action run replaces the file with the real feed.

## Credits

Launch data © [The Space Devs — Launch Library 2](https://thespacedevs.com/llapi) (free, attribution appreciated). Fonts: Oswald, Inter, IBM Plex Mono via Google Fonts. Not affiliated with any launch provider.
