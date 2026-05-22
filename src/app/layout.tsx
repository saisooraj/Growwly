import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ThemeProvider from '@/components/ui/ThemeProvider'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Growwly – Personal Finance Tracker',
  description: 'Track expenses, plan budgets, and grow your finances.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  borderRadius: '12px',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#8b5cf6', secondary: '#f8fafc' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
