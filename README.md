# OmniSite

Enterprise construction management platform designed for Nepali construction realities — DoR Norms 2075, FIDIC contracts, district-specific rates.

## Features

- **15 modules:** Dashboard, BOQ & Rate Analysis, Scheduler, Daily Operations, Equipment, Procurement, Financials, Subcontractor, Drawings, Correspondence, Q&S, Report Designer, Time & Attendance, Admin, Chat
- **3-pane workspace** with macOS-style dock navigation
- **3 themes:** OmniSite Classic, Procore High-Contrast, Dark Field Mode
- **Real-time collaboration** via Supabase (cursors, chat, live data sync)
- **Mobile-responsive** — 2-pane tabbed layout on phones
- **Persistent storage** — Supabase PostgreSQL when configured, localStorage fallback
- **Keyboard shortcuts** for all 15 modules
- **Global search** (⌘K) across BOQ items, tasks, drawings, letters, NCRs, equipment, workers

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
- **State:** Zustand + TanStack Query patterns
- **Icons:** Lucide React
- **Animations:** Framer Motion

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A Supabase project (free at [supabase.com](https://supabase.com))

### Installation

```bash
# Clone the repo
git clone https://github.com/Nacrose/Omnisite.git
cd Omnisite

# Install dependencies
bun install

# Copy env template and fill in your Supabase credentials
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Run database schema (in Supabase SQL Editor)
# Copy contents of supabase-schema.sql → Run
# Copy contents of supabase-seed.sql → Run

# Start dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Without Supabase

The app works without any database — it falls back to localStorage. All data persists in the browser but won't sync across devices. Just skip the `.env.local` step.

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Self-hosting

```bash
bun run build
bun run start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with ThemeProvider
│   ├── page.tsx            # Main app shell (dock, top bar, module router)
│   └── globals.css         # Theme engine (3 themes) + global styles
├── components/
│   ├── modules/            # 15 feature modules (each in its own folder)
│   ├── dock-nav.tsx        # macOS-style dock with auto-hide + magnification
│   ├── command-palette.tsx # Global search (⌘K)
│   ├── status-bar.tsx      # Bottom status bar with sync indicator
│   └── ...
├── lib/
│   ├── supabase.ts         # Supabase client (lazy init)
│   ├── app-store.ts        # Zustand store (module state, persistence)
│   ├── use-synced-state.ts # Hybrid Supabase/localStorage hook
│   └── ...
└── ...
```

## License

MIT
