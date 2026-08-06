'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const ReportsModule = dynamic(
  () => import('@/components/modules/reports').then((m) => m.ReportsModule),
  { loading: () => <ModuleLoadingFallback />, ssr: true }
)

export default function Page() {
  return <ReportsModule />
}
