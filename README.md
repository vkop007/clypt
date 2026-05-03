# Clypt

<p align="center">
  <img
    width="885"
    height="799"
    alt="Screenshot 2026-05-03 at 2 18 43 PM"
    src="https://github.com/user-attachments/assets/46e5c420-8099-44f7-a77b-698c53f07706"
  />
</p>

#
**Clypt** is a fast, modern web app for downloading video and audio from 1,000+ sites — YouTube, Vimeo, Twitter/X, Instagram, SoundCloud, TikTok, and many more — powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp).

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **1,000+ supported sites** via yt-dlp
- **Multiple output formats** — MP4, WebM, MP3, M4A, WAV, OGG, GIF
- **Quality selection** — choose resolution per video (360p → 4K)
- **Batch downloads** — paste multiple URLs at once
- **Trim clips** — download only a specific time range
- **Scheduled downloads** — queue jobs to start at a future time
- **Playlist support** — optionally expand playlists
- **Real-time progress** — live speed, ETA and percentage while downloading
- **Download history** — persisted locally in the browser
- **Dark / light mode**
- **Vercel-ready** — single streaming endpoint, no external database required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Components | Radix UI primitives + shadcn-style |
| Downloader | yt-dlp (subprocess) |
| GIF export | ffmpeg |
| State | React hooks + localStorage |
| Deployment | Vercel / Railway / any Node host |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 9+
- **yt-dlp** — [install guide](https://github.com/yt-dlp/yt-dlp#installation)
- **ffmpeg** — required for GIF export and some format merges ([install guide](https://ffmpeg.org/download.html))

### Local development

```bash
# 1. Clone the repo
git clone https://github.com/vkop007/clypt.git
cd clypt

# 2. Install dependencies
pnpm install

# 3. Copy env file and fill in values
cp .env.example .env.local

# 4. Start the dev server
pnpm --filter @workspace/clypt-next run dev
```

The app will be available at `http://localhost:3000`.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `YTDLP_PATH` | No | `yt-dlp` | Absolute path to the yt-dlp binary |
| `BASE_PATH` | No | `` (empty) | Sub-path prefix, e.g. `/clypt` (leave empty for Vercel) |

---

## Deploying to Vercel

Clypt is fully compatible with Vercel (Pro plan recommended for the 300-second function timeout needed for large downloads).

### Steps

1. **Fork** this repository.

2. **Import** the project into [Vercel](https://vercel.com/new).

3. Set the **Root Directory** to `artifacts/clypt-next`.

4. Add environment variables in the Vercel dashboard:
   - `YTDLP_PATH` — leave blank; yt-dlp is auto-installed at build time via `vercel.json`

5. Click **Deploy**.

### Notes

- `vercel.json` sets `maxDuration: 300` on download routes (requires Vercel Pro/Team).
- yt-dlp is installed automatically during the build step (`pip install yt-dlp`).
- ffmpeg is pre-installed in Vercel's Lambda environment.
- Downloaded files are temporarily stored in `/tmp` (512 MB limit). Files are deleted immediately after the browser saves them.
- Each download runs inside a single streaming HTTP response, so no external database or Redis is needed.

### Alternative hosting

For very large files or unlimited concurrency, deploy on a persistent server:

| Platform | Notes |
|---|---|
| [Railway](https://railway.app) | One-click Docker deploy, persistent `/tmp` |
| [Render](https://render.com) | Free tier available, auto-deploys from GitHub |
| VPS / bare metal | Full control, install yt-dlp + ffmpeg natively |

---

## Project Structure

```
artifacts/clypt-next/
├── app/
│   ├── api/
│   │   └── videos/
│   │       ├── download/          # Combined streaming download endpoint
│   │       │   └── [jobId]/file/  # File-serve endpoint
│   │       ├── fetch/             # Fetch video metadata
│   │       ├── thumbnail/         # Proxy thumbnails (CORS)
│   │       └── playlist/          # Expand playlist URLs
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── home.tsx                   # Main app shell
│   ├── video-card.tsx             # Per-video download card
│   ├── trim-modal.tsx             # Clip trimming UI
│   ├── schedule-modal.tsx         # Scheduled download UI
│   └── ui/                        # Reusable primitives
├── hooks/
│   ├── use-download-queue.ts      # Download state machine
│   ├── use-download-history.ts    # localStorage history
│   └── use-recent-searches.ts     # localStorage recent URLs
├── lib/
│   ├── api.ts                     # API base URL helper
│   ├── ytdlp.ts                   # yt-dlp path + format helpers
│   └── jobs-store.ts              # (legacy, kept for reference)
├── .env.example
├── vercel.json
└── next.config.ts
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

---

## License

[MIT](LICENSE) — © 2025 Clypt contributors
