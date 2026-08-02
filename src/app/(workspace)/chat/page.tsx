'use client'

import dynamic from 'next/dynamic'
import { ModuleLoadingFallback } from '@/components/modules/module-loading'

const ChatModule = dynamic(() => import('@/components/modules/chat').then((m) => m.ChatModule), {
  loading: () => <ModuleLoadingFallback />,
  ssr: false,
})

export default function Page() {
  return <ChatModule />
}
