'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const TimeAttendanceModule = dynamic(
  () => import('@/components/modules/time-attendance').then((m) => m.TimeAttendanceModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <TimeAttendanceModule />
}
