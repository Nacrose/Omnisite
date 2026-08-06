'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const VendorsModule = dynamic(
  () => import('@/components/modules/vendors').then((m) => m.VendorsModule),
  { loading: () => <ModuleLoadingFallback />, ssr: true }
)

export default function Page() {
  return <VendorsModule />
}
