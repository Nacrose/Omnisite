'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const ProcurementModule = dynamic(
  () => import('@/components/modules/procurement').then((m) => m.ProcurementModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <ProcurementModule />
}
