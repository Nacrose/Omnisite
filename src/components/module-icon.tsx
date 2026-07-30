'use client'

import {
  LayoutDashboard, Calculator, GanttChart, ClipboardList, Truck,
  PackageSearch, Landmark, Users, FileStack, Mail, ShieldCheck,
  FileBarChart, Fingerprint, Settings, MessageSquare,
  type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Calculator, GanttChart, ClipboardList, Truck,
  PackageSearch, Landmark, Users, FileStack, Mail, ShieldCheck,
  FileBarChart, Fingerprint, Settings, MessageSquare,
}

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LayoutDashboard
  return <Icon className={className} />
}
