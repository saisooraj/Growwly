'use client'

import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AuthGuard from '@/components/ui/AuthGuard'
import ChatBot from '@/components/chat/ChatBot'

interface Props {
  title: string
  children: React.ReactNode
}

export default function AppShell({ title, children }: Props) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header title={title} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
        <ChatBot />
      </div>
    </AuthGuard>
  )
}
