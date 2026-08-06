import { createCrudHandler } from '@/lib/crud-handler'
import { workerAttendanceSchema } from '@/lib/validation'

// GET /api/worker-attendance?project_id=...&worker_id=...&date=...
//   Returns per-day attendance rows. Optional worker_id / date filters
//   narrow the result set so the payroll export can walk a pay-period
//   range without loading every row ever logged.
// POST /api/worker-attendance — upsert a per-day record.
//   Write access: PM + Site Engineer + Foreman. Storekeeper is read-only.
//   Matches migration 31 RLS.
// DELETE /api/worker-attendance?id=... — PM-only cleanup.
//
// PII: workers.phone is masked in the audit log by mask_pii (migration 09).
// worker_attendance itself stores no PII (only worker_id FK + hours + date).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'worker_attendance',
  schema: workerAttendanceSchema,
  // Sort by date descending so the most recent attendance appears first.
  cursorField: 'date',
  orderField: 'date',
  orderAscending: false,
})
