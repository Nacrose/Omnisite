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
import {
  type QsItem,
  type QsCap,
  type QsFilter,
  type QsItemType,
  INITIAL_ITEMS,
  NCR_WORKFLOW,
} from './types'
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
    // "Close" transition (which releases the billing hold) behind a confirm,
    // AND validate that a CAP exists before Open → CAP Submitted.
    const target = items.find((i) => i.id === id)
    if (!target || target.type !== 'NCR') return
    const next = NCR_WORKFLOW[target.status]
    if (!next) return

    // CAP content validation — Open → CAP Submitted requires a non-empty
    // root cause + action + assignee. Without this, an empty CAP could be
    // submitted and the consultant sign-off step would have nothing to review.
    // (P1-7 in gap analysis.)
    if (next === 'CAP Submitted') {
      const cap = target.cap
      if (!cap || !cap.rootCause?.trim() || !cap.action?.trim() || !cap.assignee?.trim()) {
        toast.error('Cannot advance — CAP incomplete', {
          description:
            'Root cause, corrective action, and assignee are required before submitting the CAP to the consultant.',
        })
        return
      }
    }

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

  // Create a new Q&S item of the given type. Generates an ID like
  // `NCR-<3-digit>` based on the current count of that type, sets it to
  // the initial status for the type (Open for NCR, Submitted for Punch /
  // Incident / Near-Miss / ITR), and selects it so the inspector opens.
  // (Replaces the "coming soon" toast — P1-7 in gap analysis.)
  const createItem = (filter: QsFilter) => {
    if (filter === 'All') return
    const type = filter as QsItemType
    const typedItems = items.filter((i) => i.type === type)
    const nextNum = typedItems.length + 1
    const newId = `${type}-${String(nextNum).padStart(3, '0')}`
    // Guard against ID collisions on rapid re-create
    if (items.some((i) => i.id === newId)) {
      const fallback = `${type}-${Date.now().toString().slice(-6)}`
      toast.error('ID collision — using fallback', { description: fallback })
      // proceed with the fallback
      const newItem: QsItem = buildNewItem(fallback, type)
      setItems((prev) => [newItem, ...prev])
      setFilter(type)
      setSelectedId(newItem.id)
      return
    }
    const newItem = buildNewItem(newId, type)
    setItems((prev) => [newItem, ...prev])
    setFilter(type)
    setSelectedId(newItem.id)
    toast.success(`${type} created`, {
      description: `${newId} · fill in the title, location, and assignee before advancing.`,
    })
  }

  function buildNewItem(id: string, type: QsItemType): QsItem {
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    // NCRs start Open (workflow entry point). Punch / Incident / Near-Miss /
    // ITR start as Submitted.
    const initialStatus: QsItem['status'] = type === 'NCR' ? 'Open' : 'Submitted'
    return {
      id,
      type,
      title: `New ${type} — edit title`,
      status: initialStatus,
      date: today,
      severity: 'medium',
      billingHold: type === 'NCR', // NCRs auto-trigger a billing hold
    }
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
            onCreateItem={createItem}
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
          onCreateItem={createItem}
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
