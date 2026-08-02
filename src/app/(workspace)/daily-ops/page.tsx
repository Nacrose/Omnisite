'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const DailyOpsModule = dynamic(
  () => import('@/components/modules/daily-ops').then((m) => m.DailyOpsModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <DailyOpsModule />
}
