'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const BoqModule = dynamic(() => import('@/components/modules/boq').then((m) => m.BoqModule), {
  loading: () => <ModuleLoadingFallback />,
  ssr: true,
})

export default function Page() {
  return <BoqModule />
}
