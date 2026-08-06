'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const QsModule = dynamic(() => import('@/components/modules/qs').then((m) => m.QsModule), {
  loading: () => <ModuleLoadingFallback />,
  ssr: true,
})

export default function Page() {
  return <QsModule />
}
