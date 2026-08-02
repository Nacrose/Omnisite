'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const DashboardModule = dynamic(
  () => import('@/components/modules/dashboard').then((m) => m.DashboardModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <DashboardModule />
}
