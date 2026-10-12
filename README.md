<div align="center">
  <img src="public/logo.png" alt="Cadence Logo" width="150" />

  <h1>Cadence - Hybrid Local-First Habit Tracker</h1>

  <p>
    <strong>A lightning-fast, beautiful, and hybrid local-first habit tracker designed to help you build consistency and maintain your momentum — 100% functional offline, with optional cloud sync.</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel" alt="Vercel" />
    <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa" alt="PWA Ready" />
    <img src="https://img.shields.io/badge/Local--First-4CAF50?style=for-the-badge" alt="Local First" />
    <img src="https://img.shields.io/badge/Supabase-Cloud%20Sync-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase Sync" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

## 📸 Screenshots

|                                    Light Mode                                     |                                    Dark Mode                                    |
| :-------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------: |
|      <img src="public/screenshots/light.png" alt="Light Mode" width="400"/>       |      <img src="public/screenshots/dark.png" alt="Dark Mode" width="400"/>       |
|                               **Light Statistics**                                |                               **Dark Statistics**                               |
| <img src="public/screenshots/lightstats.png" alt="Light Statistics" width="400"/> | <img src="public/screenshots/darkstats.png" alt="Dark Statistics" width="400"/> |
|                                   **Settings**                                    |                              **Mobile Experience**                              |
|      <img src="public/screenshots/settings.png" alt="Settings" width="400"/>      | <img src="public/screenshots/mobile.png" alt="Mobile Experience" width="400"/>  |

## ✨ Key Features

- ✨ **Frictionless Onboarding:** Start instantly without an account using local storage (IndexedDB). Optionally sign in with Google to securely sync your habits and streaks across all your devices.
- **⚡ Hybrid Local-First Architecture:** Cadence works completely offline by default. Your data is stored locally using IndexedDB, ensuring zero latency, instant loads, and absolute privacy. When you're ready, connect with Google to seamlessly sync your habits and routines across all your devices via Supabase.
- **📱 Progressive Web App (PWA):** Install Cadence directly to your home screen or desktop. It functions perfectly as a native-feeling app on any device, complete with offline support and standalone launch.
- **↩️ Robust Undo System:** Made a mistake? Our comprehensive undo system ensures you can effortlessly revert changes without fear of losing your progress or messing up your streak.
- **🌗 Beautiful UI:** A clean, modern interface with support for both light and dark modes, built for focus and ease of use.

## 🛠️ Tech Stack

- **Frontend Framework:** React
- **Styling:** Tailwind CSS
- **Local Persistence:** IndexedDB
- **Cloud Sync & Auth:** Supabase (Google OAuth & Realtime)
- **Platform:** PWA
- **Deployment:** Vercel

## 🚀 Local Setup

To get a local copy up and running, follow these simple steps.

**1. Clone the repo**

```sh
git clone https://github.com/your_username/cadence.git
cd cadence
```

**2. Install NPM packages**

```sh
npm install
```

**3. Run the development server**

```sh
npm run dev
```
