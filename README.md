# Cadence

[![Live Demo](https://img.shields.io/badge/Live%20Demo-cadence--shalash1.vercel.app-09090b?logo=vercel&logoColor=white)](https://cadence-shalash1.vercel.app/)

Cadence is a calm, offline-first habit tracker for building daily routines, maintaining streaks, and making steady progress. Your data stays available locally through IndexedDB, even when you are offline.

## Features

- **Offline-first tracking** with local IndexedDB persistence.
- **Routine management** for organizing daily habits into repeatable flows.
- **Habit streaks** with daily check-ins and progress statistics.
- **Goals and calendar views** for a broader view of progress.
- **Dark mode** with responsive desktop and mobile layouts.
- **Installable PWA** for a focused standalone experience.

## App Icons

The PWA icon set lives in `public/`:

- `favicon-light.svg` and `favicon-dark.svg`: theme-aware browser favicons.
- `favicon-16.png` and `favicon-32.png`: standard browser fallbacks.
- `apple-touch-icon.png`: 180x180 high-contrast iOS home screen icon.
- `icon-192.png` and `icon-512.png`: 192x192 and 512x512 PNG icons used for standard and maskable manifest entries.

Keep the PNG assets opaque and preserve generous padding around the mark so Android maskable icon safe areas and iOS home screen cropping remain clear.

## Tech Stack

- TanStack Start
- React 19
- Tailwind CSS
- Vite
- Nitro
- Vercel

## Quick Start

Requirements: Node.js and npm.

```sh
git clone <repository-url>
cd cadence
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

Run the project checks with:

```sh
npm run lint
```

## Live Demo

Visit [cadence-shalash1.vercel.app](https://cadence-shalash1.vercel.app/) to use Cadence in the browser.
