'use client'

// ─── Q&S module — thin shell ─────────────────────────────────────────────────
// Extracted from the monolithic qs.tsx. Wires together the left register
// pane (filter chips + search + billing holds) and the right inspector pane
// (item detail + NCR workflow + photo gallery) inside a Workspace2Pane.
//
// Owns:
//   • useSyncedState hook against `qs_items` (with the seed fallback)
//   • selected-id / filter / search UI state
//   • advanceNcr / saveCap / setLocation handlers (the inspector is a pure
//     view of these — they live here so the workflow state machine stays
//     co-located with the items array it mutates).

import { useState } from 'react'
import { Workspace2Pane } from '@/components/workspace-3pane'
import { toast } from 'sonner'
import { confirm } from '@/components/ui/confirm-dialog'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { type QsItem, type QsCap, type QsFilter, INITIAL_ITEMS, NCR_WORKFLOW } from './types'
import { QsRegistersPane } from './registers'
import { QsInspector } from './inspector'

export function QsModule() {
  const [selectedId, setSelectedId] = useState('NCR-034')
  const [filter, setFilter] = useState<QsFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems, qsLoading] = useSyncedState<QsItem[]>(
    'omnisite-qs-items',
    'qs_items',
    () => structuredClone(INITIAL_ITEMS) as typeof INITIAL_ITEMS,
    {
      fieldMap: {
        linkedBoq: 'linked_boq',
        dueDate: 'due_date',
        billingHold: 'billing_hold',
        locationId: 'location_id',
        capSubmittedDate: 'cap_submitted_date',
        closedDate: 'closed_date',
      },
      primaryKey: 'id',
    }
  )
  const filteredByType = filter === 'All' ? items : items.filter((i) => i.type === filter)
  const filtered = searchQuery.trim()
    ? filteredByType.filter(
        (i) =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.assignee || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.linkedBoq || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByType
  // Inspector should follow the filter — if the selected item isn't in the
  // filtered list, fall back to the first filtered item instead of showing
  // a stale selection from a different category.
  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0]

  // Advance an NCR to the next workflow status.
  // Guarded: only NCR-type items can be advanced. Punch / Incident /
  // Near-Miss items have their own (simpler) lifecycle and must NOT be
  // pushed into NCR-only statuses like 'CAP Submitted'.
  const advanceNcr = async (id: string) => {
    // Look up the target item to determine the next workflow status before
    // applying any state changes. This lets us gate the financially risky
    // "Close" transition (which releases the billing hold) behind a confirm.
    const target = items.find((i) => i.id === id)
    if (!target || target.type !== 'NCR') return
    const next = NCR_WORKFLOW[target.status]
    if (!next) return
    if (next === 'Closed') {
      const ok = await confirm(
        `Close ${target.id}?`,
        'Closing this NCR will release the billing hold on the linked BOQ item. This has financial implications.',
        'Close NCR',
        true
      )
      if (!ok) return
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        if (it.type !== 'NCR') return it
        const n = NCR_WORKFLOW[it.status]
        if (!n) return it
        // When closing, release the billing hold
        const newBillingHold = n === 'Closed' ? false : it.billingHold
        // Stamp the transition date so the inspector's status notice can show
        // a real "CAP submitted on {date}" / "Closed on {date}" message
        // instead of a fabricated name + timestamp. Format: DD Mon YYYY.
        const today = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        const capSubmittedDate = n === 'CAP Submitted' ? today : it.capSubmittedDate
        const closedDate = n === 'Closed' ? today : it.closedDate
        return {
          ...it,
          status: n as QsItem['status'],
          billingHold: newBillingHold,
          capSubmittedDate,
          closedDate,
        }
      })
    )
    toast.success('NCR advanced', {
      description: `${target.id} → ${next}${next === 'Closed' ? ' · billing hold released' : ''}`,
    })
  }

  // Save CAP (corrective action plan) on an NCR
  const saveCap = (id: string, cap: QsCap) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cap } : it)))
    toast.success('Corrective Action Plan saved', {
      description: `${id} ready for consultant submission`,
    })
  }

  // Set the linked location on a QS item (NCR / ITR / etc.)
  const setLocation = (id: string, locationId: string | null) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, locationId: locationId ?? undefined } : it))
    )
    toast.success('Location linked', {
      description: locationId ? `${id} → ${locationId}` : `Cleared location on ${id}`,
    })
  }

  if (qsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading Q&S register…" />
      </div>
    )
  }

  // Defensive: if filters collapse to an empty list (no selection), show an
  // empty-state inspector rather than crashing on `selected.id`.
  if (!selected) {
    return (
      <Workspace2Pane
        leftPane={
          <QsRegistersPane
            items={items}
            filter={filter}
            onFilterChange={setFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        }
        rightPane={
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            No items match the current filter.
          </div>
        }
        leftPaneWidth="240px"
        rightPaneWidth="380px"
      />
    )
  }

  return (
    <Workspace2Pane
      leftPane={
        <QsRegistersPane
          items={items}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      }
      rightPane={
        <QsInspector
          key={selected.id}
          item={selected}
          onAdvance={advanceNcr}
          onSaveCap={saveCap}
          onSetLocation={setLocation}
        />
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}
