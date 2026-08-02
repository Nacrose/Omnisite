'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const FinancialsModule = dynamic(
  () => import('@/components/modules/financials').then((m) => m.FinancialsModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <FinancialsModule />
}
