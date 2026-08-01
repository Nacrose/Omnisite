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

# Set up the database (in Supabase Dashboard → SQL Editor):
# 1. Run supabase-schema.sql (creates all tables + triggers)
# 2. Run supabase-rls-policies.sql (enables row-level security)
# 3. Run supabase-seed.sql (inserts demo project + BOQ + tasks + CBS + workers)
# 4. Run supabase/migrations/00000000000003_task_dependencies.sql (CPM links)
# 5. Run supabase/migrations/00000000000004_cbs_subtree_trigger.sql (DB rollup)
#
# Or run the combined file: download/omnisite-full-setup.sql (all 5 in order)

# Create your first user in Supabase Dashboard → Authentication → Users
# Then assign them to the project as PM (in SQL Editor):
# INSERT INTO user_projects (user_id, project_id, role)
# VALUES ('<auth.users.id>', '00000000-0000-0000-0000-000000000001', 'PM');

# Start dev server
bun run dev
```

Open http://localhost:3000

### Without Supabase

The app works without any database — it falls back to localStorage. All data persists in the browser but won't sync across devices. Just skip the `.env.local` step and the database setup steps.

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for audit logging)
   - `UPSTASH_REDIS_REST_URL` (for rate limiting)
   - `UPSTASH_REDIS_REST_TOKEN`
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
