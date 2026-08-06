'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const SchedulerModule = dynamic(
  () => import('@/components/modules/scheduler').then((m) => m.SchedulerModule),
  { loading: () => <ModuleLoadingFallback />, ssr: true }
)

export default function Page() {
  return <SchedulerModule />
}
