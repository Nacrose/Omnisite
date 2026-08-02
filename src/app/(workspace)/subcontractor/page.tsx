'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const SubcontractorModule = dynamic(
  () => import('@/components/modules/subcontractor').then((m) => m.SubcontractorModule),
  { loading: () => <ModuleLoadingFallback />, ssr: false }
)

export default function Page() {
  return <SubcontractorModule />
}
