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

## Feeds & extras

- **Calendar feed**: `launches.ics` — subscribe in Google/Apple/Outlook and every launch lands in your calendar, auto-updating.
- **RSS**: `feed.xml` — pipe launches into any reader, IFTTT or a Discord bot.
- **Embed widget**: put the next-launch countdown on any site:
  `<iframe src="https://rocketlaunchtracker.com/embed.html" width="340" height="200" style="border:0"></iframe>` (add `?theme=dark` for dark).
- **Location pages**: `/cape-canaveral.html`, `/vandenberg.html`, `/starbase.html`, `/florida.html`.
- **PWA**: installable on phones (Add to Home Screen), works offline with last-loaded data.

## Credits

Launch data © [The Space Devs — Launch Library 2](https://thespacedevs.com/llapi) (free, attribution appreciated). Fonts: Oswald, Inter, IBM Plex Mono via Google Fonts. Not affiliated with any launch provider.
