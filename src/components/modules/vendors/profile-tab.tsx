'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Building2,
  Package,
  HardHat,
  Landmark,
  Wallet,
  Percent,
  FileCheck2,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CircleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Vendor, VendorCategory, VendorStatus, ComplianceDoc } from '@/lib/types/vendor'

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<VendorCategory, string> = {
  supplier: 'Supplier',
  subcontractor: 'Subcontractor',
  consultant: 'Consultant',
  labour: 'Labour Gang',
}

const CATEGORY_BADGE_CLASS: Record<VendorCategory, string> = {
  supplier: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  subcontractor: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  consultant: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  labour: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

const RATING_TONES: Record<string, string> = {
  A: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  B: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  C: 'border-red-500/40 text-red-700 dark:text-red-300',
}

function ratingClass(rating: string): string {
  const head = rating.trim().charAt(0).toUpperCase()
  return RATING_TONES[head] ?? ''
}

/**
 * Compliance status for a doc, derived from its expiry date.
 *   - missing: no expiry and no fileUrl
 *   - ok: >30 days to expiry (or no expiry but file uploaded)
 *   - warn: expiring within 30 days (but not yet expired)
 *   - exp: already expired
 *
 * Thresholds match the Compliance Dashboard (30-day amber window) so the
 * profile tab and the dashboard don't disagree on the same vendor's doc
 * status (audit V1-5 — previously the profile used 90/180-day thresholds
 * while the dashboard used 30 days, so a doc at 60 days showed "warn" in
 * the profile but "ok" in the dashboard).
 */
function complianceStatus(doc: ComplianceDoc): 'ok' | 'warn' | 'exp' | 'missing' {
  if (!doc.expiryDate && !doc.fileUrl) return 'missing'
  if (!doc.expiryDate) return 'ok' // no expiry → indefinite
  const daysTo = (Date.parse(doc.expiryDate) - Date.now()) / 86_400_000
  if (Number.isNaN(daysTo)) return 'missing'
  if (daysTo < 0) return 'exp'
  if (daysTo <= 30) return 'warn'
  return 'ok'
}

const STATUS_DOT_CLASS: Record<string, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  exp: 'bg-red-500',
  missing: 'bg-slate-400',
}

const STATUS_LABEL_SHORT: Record<string, string> = {
  ok: 'Valid',
  warn: 'Expiring',
  exp: 'Expired',
  missing: 'Missing',
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Building2
  title: string
  desc?: string
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <div className="text-[10px] font-semibold tracking-wider uppercase">{title}</div>
      {desc && <div className="text-muted-foreground/70 ml-auto text-[10px]">{desc}</div>}
    </div>
  )
}

// ─── ProfileTab ──────────────────────────────────────────────────────────────

interface ProfileTabProps {
  vendor: Vendor
  /** Fired with the patched vendor whenever a field changes. */
  onChange: (updated: Vendor) => void
}

export function ProfileTab({ vendor, onChange }: ProfileTabProps) {
  const patch = (p: Partial<Vendor>) => onChange({ ...vendor, ...p })

  const patchDoc = (idx: number, p: Partial<ComplianceDoc>) => {
    const docs = vendor.docs ? vendor.docs.slice() : []
    const cur = docs[idx] ?? { type: 'other', label: '' }
    docs[idx] = { ...cur, ...p }
    patch({ docs })
  }

  const addDoc = () => {
    const docs = vendor.docs ? vendor.docs.slice() : []
    docs.push({ type: 'other', label: 'New document' })
    patch({ docs })
  }

  return (
    <div className="space-y-5 p-4 text-xs">
      {/* ─── Identity ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={Building2}
          title="Identity"
          desc={`${vendor.id} · ${CATEGORY_LABEL[vendor.category]}`}
        />
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Vendor name">
              <Input
                className="h-8 text-xs"
                value={vendor.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Trade name">
              <Input
                className="h-8 text-xs"
                value={vendor.tradeName ?? ''}
                onChange={(e) => patch({ tradeName: e.target.value || undefined })}
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Category">
              <div className="flex h-8 items-center">
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', CATEGORY_BADGE_CLASS[vendor.category])}
                >
                  {CATEGORY_LABEL[vendor.category]}
                </Badge>
              </div>
            </FieldRow>
            <FieldRow label="Status">
              <div className="flex h-8 items-center gap-2">
                <select
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 flex-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
                  value={vendor.status}
                  onChange={(e) => patch({ status: e.target.value as VendorStatus })}
                >
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </div>
            </FieldRow>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Rating">
              <div className="flex h-8 items-center gap-2">
                <select
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 flex-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
                  value={vendor.rating}
                  onChange={(e) => patch({ rating: e.target.value })}
                >
                  {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', '—'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {vendor.rating && vendor.rating !== '—' && (
                  <Badge variant="outline" className={cn('text-[9px]', ratingClass(vendor.rating))}>
                    {vendor.rating}
                  </Badge>
                )}
              </div>
            </FieldRow>
            <FieldRow label="PAN">
              <Input
                className="h-8 font-mono text-xs"
                value={vendor.pan ?? ''}
                onChange={(e) => patch({ pan: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="GST / VAT">
              <Input
                className="h-8 font-mono text-xs"
                value={vendor.gst ?? ''}
                onChange={(e) => patch({ gst: e.target.value || undefined })}
              />
            </FieldRow>
          </div>
          <FieldRow label="VAT No. (if separate)">
            <Input
              className="h-8 font-mono text-xs"
              value={vendor.vatNo ?? ''}
              onChange={(e) => patch({ vatNo: e.target.value || undefined })}
            />
          </FieldRow>
        </div>
      </section>

      <Separator />

      {/* ─── Contact ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={HardHat} title="Contact" />
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Contact person">
              <Input
                className="h-8 text-xs"
                value={vendor.contactPerson ?? ''}
                onChange={(e) => patch({ contactPerson: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="Phone">
              <Input
                className="h-8 font-mono text-xs"
                value={vendor.phone ?? ''}
                onChange={(e) => patch({ phone: e.target.value || undefined })}
              />
            </FieldRow>
          </div>
          <FieldRow label="Email">
            <Input
              type="email"
              className="h-8 text-xs"
              value={vendor.email ?? ''}
              onChange={(e) => patch({ email: e.target.value || undefined })}
            />
          </FieldRow>
          <FieldRow label="Address">
            <Input
              className="h-8 text-xs"
              value={vendor.address ?? ''}
              onChange={(e) => patch({ address: e.target.value || undefined })}
            />
          </FieldRow>
        </div>
      </section>

      <Separator />

      {/* ─── Banking ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Landmark} title="Banking" desc="For vendor payments" />
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Account name">
              <Input
                className="h-8 text-xs"
                value={vendor.bankAccountName ?? ''}
                onChange={(e) => patch({ bankAccountName: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="Account no.">
              <Input
                className="h-8 font-mono text-xs"
                value={vendor.bankAccountNo ?? ''}
                onChange={(e) => patch({ bankAccountNo: e.target.value || undefined })}
              />
            </FieldRow>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Bank name">
              <Input
                className="h-8 text-xs"
                value={vendor.bankName ?? ''}
                onChange={(e) => patch({ bankName: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="Branch">
              <Input
                className="h-8 text-xs"
                value={vendor.bankBranch ?? ''}
                onChange={(e) => patch({ bankBranch: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="IFSC / SWIFT">
              <Input
                className="h-8 font-mono text-xs"
                value={vendor.bankIfsc ?? ''}
                onChange={(e) => patch({ bankIfsc: e.target.value || undefined })}
              />
            </FieldRow>
          </div>
        </div>
      </section>

      <Separator />

      {/* ─── Payment Terms ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Wallet} title="Payment Terms" desc="Applied to vendor invoices" />
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Credit days">
              <Input
                type="number"
                min={0}
                className="h-8 font-mono text-xs"
                value={vendor.creditDays ?? 0}
                onChange={(e) => patch({ creditDays: Number(e.target.value) || 0 })}
              />
            </FieldRow>
            <FieldRow label="Advance %">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="h-8 font-mono text-xs"
                value={vendor.advancePct ?? 0}
                onChange={(e) => patch({ advancePct: Number(e.target.value) || 0 })}
              />
            </FieldRow>
            <FieldRow label="Retention %">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="h-8 font-mono text-xs"
                value={vendor.retentionPct ?? 0}
                onChange={(e) => patch({ retentionPct: Number(e.target.value) || 0 })}
              />
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="TDS section">
              <Input
                className="h-8 font-mono text-xs"
                placeholder="e.g. 194C"
                value={vendor.tdsSection ?? ''}
                onChange={(e) => patch({ tdsSection: e.target.value || undefined })}
              />
            </FieldRow>
            <FieldRow label="TDS rate %">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.05}
                className="h-8 font-mono text-xs"
                value={vendor.tdsRate ?? 0}
                onChange={(e) => patch({ tdsRate: Number(e.target.value) || 0 })}
              />
            </FieldRow>
          </div>
          <div className="bg-secondary/40 flex items-center gap-2 rounded-md p-2 text-[10px]">
            <Percent className="text-muted-foreground h-3 w-3" />
            <span className="text-muted-foreground">
              Net payable = Earned − Advance recovery − Retention − TDS − Other deductions
            </span>
          </div>
        </div>
      </section>

      <Separator />

      {/* ─── Compliance Documents ─────────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={FileCheck2}
          title="Compliance Documents"
          desc={`${vendor.docs?.length ?? 0} on file`}
        />
        <div className="space-y-1.5">
          {(vendor.docs ?? []).length === 0 && (
            <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-3 text-center text-[10px]">
              No compliance documents uploaded yet.
            </div>
          )}
          {(vendor.docs ?? []).map((doc, idx) => {
            const status = complianceStatus(doc)
            return (
              <div
                key={`${doc.type}-${idx}`}
                className="rounded-md border border-[var(--pane-divider)] p-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      STATUS_DOT_CLASS[status]
                    )}
                    title={STATUS_LABEL_SHORT[status]}
                  />
                  <span className="text-[10px] font-medium">{doc.label || doc.type}</span>
                  <span className="text-muted-foreground ml-auto text-[9px] uppercase">
                    {doc.type.replace(/_/g, ' ')}
                  </span>
                  {status === 'warn' && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-500/15 text-[9px] text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                      Expiring
                    </Badge>
                  )}
                  {status === 'exp' && (
                    <Badge
                      variant="secondary"
                      className="bg-red-500/15 text-[9px] text-red-700 dark:text-red-300"
                    >
                      <CircleAlert className="mr-0.5 h-2.5 w-2.5" />
                      {doc.expiryDate && Date.parse(doc.expiryDate) < Date.now()
                        ? 'Expired'
                        : 'Expiring soon'}
                    </Badge>
                  )}
                  {status === 'ok' && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/15 text-[9px] text-emerald-700 dark:text-emerald-300"
                    >
                      <ShieldCheck className="mr-0.5 h-2.5 w-2.5" />
                      Valid
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <FieldRow label="Label">
                    <Input
                      className="h-7 text-[11px]"
                      value={doc.label}
                      onChange={(e) => patchDoc(idx, { label: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Expiry date">
                    <Input
                      type="date"
                      className="h-7 text-[11px]"
                      value={doc.expiryDate ?? ''}
                      onChange={(e) => patchDoc(idx, { expiryDate: e.target.value || undefined })}
                    />
                  </FieldRow>
                </div>
                {doc.fileUrl && (
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[9px]">
                    <FileCheck2 className="h-2.5 w-2.5" />
                    <a
                      href={doc.fileUrl}
                      className="hover:text-foreground hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {doc.fileUrl}
                    </a>
                    {doc.uploadedAt && <span>· uploaded {doc.uploadedAt}</span>}
                  </div>
                )}
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() =>
                      toast.info('File upload not wired yet', {
                        description: 'Will be connected to Supabase storage in a follow-up task.',
                      })
                    }
                  >
                    <Upload className="h-3 w-3" />
                    {doc.fileUrl ? 'Replace file' : 'Upload file'}
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={addDoc}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Add Compliance Document
          </Button>
        </div>
      </section>

      <Separator />

      {/* ─── Supply catalog teaser (supplier only) ────────────────────────── */}
      {vendor.category === 'supplier' && (vendor.materialsSupplied?.length ?? 0) > 0 && (
        <section>
          <SectionHeader
            icon={Package}
            title="Supply Catalog (read-only summary)"
            desc={`${vendor.materialsSupplied?.length ?? 0} materials`}
          />
          <div className="space-y-1.5">
            {(vendor.materialsSupplied ?? []).map((m) => (
              <div
                key={m.code}
                className="flex items-center justify-between rounded border border-[var(--pane-divider)] p-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium">{m.name}</div>
                  <div className="text-muted-foreground font-mono text-[9px]">{m.code}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px]">{m.rate.toLocaleString()}</div>
                  <div className="text-muted-foreground text-[9px]">
                    {m.uom}
                    {m.brand ? ` · ${m.brand}` : ''}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground text-[10px]">
              Full catalog editing lands in the Supply Catalog tab (separate task).
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
