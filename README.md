# OmniSite

**An office-based construction project documentation and planning system for contractors.**

Site teams work on hardcopy in the field. When they return to the office, engineers, accountants, and storekeepers enter the data here. OmniSite is the contractor's single source of truth for planning, documentation, and retrieval — not a field tool, not a billing replacement, not a client portal.

---

## What This App Is

- **A documentation system** — every piece of site data (BOQ, schedule, DSR, NCR, procurement, financials) is entered, stored, and retrievable here
- **A planning tool** — CPM scheduling, BOQ rate analysis, procurement planning, subcontractor management
- **Internal to the contractor's organization** — used by PMs, site engineers, storekeepers, and accountants only
- **Nepali calendar (Bikram Sambat)** for date display — English UI, no Nepali language interface
- **FIDIC-compliant** — audit trail, 3-way match procurement, NCR workflow with billing holds

## What This App Is NOT

| ❌ Not This                     | Why                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Field tool**                  | Data entry happens at the office, not on site. No offline PWA, no mobile field app.                               |
| **Billing replacement**         | Billing is done in Excel and CAD. OmniSite documents the data that feeds those tools.                             |
| **Client/consultant portal**    | Clients and consultants work on hardcopy reports. No external-facing access.                                      |
| **Vendor portal**               | Vendors don't use digital tools. Vendor profiles are for internal reference only (bank details, PAN, compliance). |
| **E-signature platform**        | All documents requiring approval are hardcopy-signed. No digital signatures.                                      |
| **BIM/CAD viewer**              | Drawings are managed in CAD. OmniSite registers drawing revisions, not renders them.                              |
| **Drone/photogrammetry tool**   | Not needed — earthwork verification happens via survey.                                                           |
| **IoT/sensor platform**         | Not needed — equipment data is entered manually.                                                                  |
| **Real-time field tracking**    | Not the use case. Data is entered after the fact, not live from site.                                             |
| **Safety incident management**  | Minor priority for now. NCRs and incidents are logged but not a full HSE module.                                  |
| **Asset handover/DLP tracking** | Not in scope currently.                                                                                           |
| **Nepali language UI**          | English interface only. BS calendar is the only Nepali localization.                                              |

---

## Features

### 15 Modules

| Module                  | Purpose                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard**           | KPI strip (SPI/CPI/EAC/Margin), S-curve, cash flow, urgent actions queue, location activity map                                                                                            |
| **BOQ & Rate Analysis** | BOQ tree with drag-drop, rate analysis (materials + labour + equipment + overheads), DoR-format CSV export                                                                                 |
| **Scheduler**           | CPM critical path, Gantt chart, resource leveling, task dependencies (FS/SS/FF/SF), EOT breach detection                                                                                   |
| **Daily Operations**    | DSR (Daily Site Report) entries, RFI register with workflow, work progress tracking                                                                                                        |
| **Equipment**           | Fleet register, fuel/burn-rate tracking, rental terms, document vault                                                                                                                      |
| **Procurement**         | Requisition → PO → GRN → 3-way match → payment release, comparative statement, FIDIC override justification                                                                                |
| **Financials**          | CBS (Cost Breakdown Structure) with DB-level rollup, budget/committed/actual/forecast, RA Bill upload                                                                                      |
| **Vendors**             | Unified vendor master (suppliers + subcontractors), profile (bank/insurance/compliance), supply catalog, purchase history, SC running bills, material reconciliation, compliance dashboard |
| **Drawings**            | Drawing register with discipline filter, revision history, upload to Supabase Storage                                                                                                      |
| **Correspondence**      | Letter register (incoming/outgoing/site instructions), reply tracking, overdue detection                                                                                                   |
| **Q&S**                 | NCR workflow (Open → CAP → Sign-off → Closed), billing hold, ITR/Punch/Incident/Near-Miss registers                                                                                        |
| **Reports**             | Drag-drop report designer, widget library, print-ready PDF via browser                                                                                                                     |
| **Time & Attendance**   | Worker list by trade, task allocation, OT calculation, payroll CSV export                                                                                                                  |
| **Admin**               | User management, material master, 3-tier rate library, RA presets, work locations                                                                                                          |
| **Chat**                | Project-wide channels, real-time messages via Supabase                                                                                                                                     |

### Work Locations

- **Location master** in Admin → Work Locations (project-specific naming: Pier 1, Floor 2, 0+000 to 0+500, etc.)
- **Location picker** on DSR, RFI, NCR, BOQ, and Scheduler forms — pick from a dropdown, no free-text
- **Location activity map** on the dashboard — visual strip showing tasks, NCRs, and DSR entries per location
- **Subcontractor assignment** — assign an SC to a location, auto-suggested when creating tasks at that location

### Vendor Management

- **Unified vendors table** — suppliers and subcontractors in one place, filtered by category
- **Vendor profile** — contact details, banking (account no, IFSC), payment terms (credit days, advance %, retention %, TDS), compliance documents with expiry tracking
- **Supply catalog** (suppliers) — what materials they supply, at what rate
- **Purchase history** (suppliers) — all POs and GRNs linked to this vendor
- **SC running bills** (subcontractors) — earned value → advance recovery → retention → TDS → deductions → net payable
- **Material reconciliation** — theoretical (from BOQ coefficients) vs actual issued, variance tracking
- **Compliance dashboard** — traffic-light view of all vendors' insurance/labour licence/PAN/GST status

### Security & Compliance

- **Row-level security** — users only see projects they're assigned to; PM powers are per-project (no cross-project escalation)
- **Transactional audit trail** — every INSERT/UPDATE/DELETE is logged with field-level diffs, never lost
- **PII masking** — worker phone numbers, vendor PAN/GST are masked in audit logs
- **CSP with per-request nonce** — no `unsafe-inline` in script-src or style-src
- **HSTS** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- **Rate limiting** — Upstash Redis with per-user and per-IP identifiers

### Performance

- **Code splitting** — each module loads as a separate chunk via `next/dynamic`
- **Virtualized lists** — BOQ grid and scheduler task outline use `@tanstack/react-virtual`
- **Memoized tree rebuilds** — BOQ/CBS/task trees only recompute when data changes
- **Debounced localStorage** — 500ms trailing debounce prevents main-thread blocking
- **Realtime project scoping** — Supabase realtime subscriptions filtered by `project_id`
- **Fetch deduplication** — concurrent identical GET requests share a single in-flight promise

### Accessibility

- **Focus traps** on all modals (help, command palette, quick-add, procurement override, audit log viewer, onboarding)
- **Keyboard navigation** — dock nav, command palette, table rows all keyboard-accessible
- **Skip-to-content link** — keyboard users can jump past the header
- **ARIA** — `role="dialog"`, `aria-modal`, `aria-current`, `aria-live` on dynamic regions

---

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript 5 (strict mode, zero `any`)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
- **State:** Zustand + custom `useSyncedState` (hybrid Supabase/localStorage)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Testing:** Vitest (277 tests) + Playwright E2E
- **CI:** GitHub Actions (lint + tsc + test + audit + build + size-check + e2e)

---

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A Supabase project (free at [supabase.com](https://supabase.com)) — optional, app works without it

### Installation

```bash
git clone https://github.com/Nacrose/Omnisite.git
cd Omnisite
bun install

# Optional: configure Supabase
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, service role key,
# and Upstash Redis URL/token (for rate limiting)

# Set up the database:
supabase db push
# Or manually paste each migration in supabase/migrations/ (in order) into
# Supabase Dashboard → SQL Editor → Run

# Create your first user in Supabase Dashboard → Authentication → Users
# Then assign them to a project as PM:
# INSERT INTO user_projects (user_id, project_id, role)
# VALUES ('<auth.users.id>', '00000000-0000-0000-0000-000000000001', 'PM');

bun run dev
```

Open http://localhost:3000

### Without Supabase (Demo Mode)

The app works without any database — it falls back to localStorage. All data persists in the browser but won't sync across devices. Just skip the `.env.local` step and the database setup steps. Enter any email/password on the login page to sign in as the demo PM user.

---

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

**Important:** Set `TRUST_PROXY=true` if behind Caddy/Nginx (for rate-limit IP detection).

---

## Database Migrations

Run these in order against your Supabase project:

| #   | File                                                          | What it does                                                                                 |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 00  | `00000000000000_schema.sql`                                   | All tables + triggers                                                                        |
| 01  | `00000000000001_rls_policies.sql`                             | Row-level security (per-project, PM-gated)                                                   |
| 02  | `00000000000002_audit_log.sql`                                | Audit log table                                                                              |
| 03  | `00000000000003_task_dependencies.sql`                        | CPM dependency links                                                                         |
| 04  | `00000000000004_cbs_subtree_trigger.sql`                      | DB-level CBS rollup                                                                          |
| 05  | `00000000000005_procurement_grns_stock.sql`                   | GRN + stock tables                                                                           |
| 06  | `00000000000006_seed_data.sql`                                | Demo project + BOQ + tasks + CBS                                                             |
| 07  | `00000000000007_transactional_audit.sql`                      | Transactional upsert/delete + audit                                                          |
| 08  | `00000000000008_audit_log_old_new_values.sql`                 | Audit old/new values                                                                         |
| 09  | `00000000000009_audit_project_id_indexes_constraints.sql`     | audit_log.project_id, 16 indexes, CHECK constraints, FKs, PII masking, search_path hardening |
| 10  | `00000000000010_vendors_and_locations.sql`                    | Unified vendors table + project_locations table                                              |
| 11  | `00000000000011_add_vendors_locations_to_audit_allowlist.sql` | Add vendors + locations to audit functions                                                   |
| 12  | `00000000000012_add_location_id_columns.sql`                  | Add location_id to tasks, dsr_entries, qs_items, boq_items                                   |

> **Tip:** Run `bun run migrations-check` to verify every migration file has been applied to your live Supabase DB. The script connects via the service role key and compares the local `supabase/migrations/` directory against the `supabase_migrations` tracking table. Exits 0 if everything's in sync, 1 if a migration is missing.

---

## Backup & Restore

`bun run backup` dumps every business table to a timestamped JSON file under `backups/`. Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (server-side only, bypasses RLS so all rows are exported regardless of project membership).

```bash
bun run backup                       # → backups/omnisite-backup-2026-08-06T07-30-00.json
bun run backup --table boq_items      # → only the BOQ table
bun run backup --out custom.json      # → custom output path
```

The output is a single self-contained JSON file with this shape:

```json
{
  "metadata": {
    "createdAt": "2026-08-06T07:30:00.000Z",
    "supabaseUrl": "https://xxx.supabase.co",
    "tableCount": 21,
    "rowCount": 4523
  },
  "tables": {
    "boq_items": [{...}, {...}],
    "tasks": [...]
  }
}
```

**Restore** is manual — there is no `restore` script. The JSON is
human-readable; load it into a fresh Supabase project via a one-off
Node script using the same REST API. For full DB backups (including
RLS policies, triggers, and the audit_log), use the Supabase
Dashboard's pg_dump UI.

**Recommended cadence:** daily, wired into a cron job. Vercel cron
can hit a `/api/cron/backup` endpoint (not yet implemented — see
P1-17 in the gap analysis). For self-hosting, add a system cron
entry:

```cron
0 2 * * * cd /path/to/Omnisite && bun run backup >> /var/log/omnisite-backup.log 2>&1
```

The `backups/` directory is in `.gitignore` — never commit a backup
file (it may contain PII like vendor PAN/GST).

---

## Project Structure

```
src/
├── app/                         # Next.js App Router
│   ├── (workspace)/             # 15 module routes (each lazy-loaded)
│   ├── api/                     # 17 REST API routes (via createCrudHandler factory)
│   └── login/                   # Auth page
├── components/
│   ├── modules/                 # 15 feature modules (each in its own folder)
│   │   ├── dashboard/           # KPI strip, charts, urgent actions, location map
│   │   ├── boq/                 # BOQ grid, handlers, RA inspector
│   │   ├── scheduler/           # Gantt canvas, task inspector, CPM
│   │   ├── daily-ops/           # DSR, RFI, work progress
│   │   ├── vendors/             # Unified vendor master (suppliers + SCs)
│   │   ├── procurement/         # Req → PO → GRN → 3-way match
│   │   ├── financials/          # CBS tree, rollup, RA bills
│   │   ├── qs/                  # NCR workflow, quality registers
│   │   ├── admin/               # Users, materials, rates, locations
│   │   └── ...                  # equipment, drawings, correspondence, etc.
│   ├── ui/                      # shadcn/ui components + LocationPicker
│   └── ...
├── data/
│   └── seed/                    # Demo seed data (separate from types)
├── lib/
│   ├── types/vendor.ts          # Unified Vendor + ProjectLocation types
│   ├── crud-handler.ts          # Factory for API route handlers
│   ├── use-synced-state.ts      # Hybrid Supabase/localStorage hook
│   ├── use-focus-trap.ts        # Modal focus trap (WAI-ARIA)
│   ├── use-presence.ts          # Realtime presence + record-level tracking
│   ├── calendar.ts              # BS/AD calendar conversion (lookup table)
│   ├── tree-utils.ts            # Shared tree operations (flatten, rebuild, find)
│   └── ...
├── supabase/
│   └── migrations/              # 13 SQL migration files
└── e2e/
    └── smoke.spec.ts            # Playwright E2E tests
```

---

## Roles & Permissions

| Role              | Can See                                    | Can Edit                                             |
| ----------------- | ------------------------------------------ | ---------------------------------------------------- |
| **PM**            | All modules                                | All modules (admin, financials, vendors, everything) |
| **Site Engineer** | All modules                                | Everything except Admin and Financials               |
| **Storekeeper**   | Dashboard, DSR, Procurement, Reports, Chat | DSR and Procurement only                             |
| **Foreman**       | Dashboard, DSR, Time & Attendance, Chat    | DSR and Time & Attendance only                       |

Roles are resolved from the `user_projects` table (DB-backed), not from client-set `user_metadata`. PM powers are strictly per-project — being PM on Project A does NOT grant access to Project B.

---

## License

MIT
