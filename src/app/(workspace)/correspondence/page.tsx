'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const CorrespondenceModule = dynamic(
  () => import('@/components/modules/correspondence').then((m) => m.CorrespondenceModule),
  { loading: () => <ModuleLoadingFallback />, ssr: true }
)

export default function Page() {
  return <CorrespondenceModule />
}
