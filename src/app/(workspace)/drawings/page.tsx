'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const DrawingsModule = dynamic(
  () => import('@/components/modules/drawings').then((m) => m.DrawingsModule),
  { loading: () => <ModuleLoadingFallback />, ssr: true }
)

export default function Page() {
  return <DrawingsModule />
}
