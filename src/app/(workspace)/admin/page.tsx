'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const AdminModule = dynamic(() => import('@/components/modules/admin').then((m) => m.AdminModule), {
  loading: () => <ModuleLoadingFallback />,
  ssr: false,
})

export default function Page() {
  return <AdminModule />
}
