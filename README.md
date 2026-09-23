# KOVA Mission Control

A shared-feeling mission control dashboard for KOVA's 45-day sprint. The current runnable prototype is a Vite + React app seeded from `handoff/seed.json`.

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app asks for an identity on first visit and persists the current prototype state in `localStorage`.

## Production build

```bash
npm run build
npm run preview
```

## Deploy

The app is configured for Vercel's static Vite deployment. From the project root:

```bash
vercel
vercel --prod
```

Build command: `npm run build`  
Output directory: `dist`

## Scope

The handoff reference implementation and seed data remain in `handoff/`. The app currently covers the operational dashboard surface: weekly, full-plan, and today views; tasks; owner filters; workstream signals; blockers; decisions; budget; timeline; review; walkthrough; exports; and activity.
