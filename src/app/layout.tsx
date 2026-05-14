import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Gym Tracker | Execution First',
  description: 'A flexible, execution-first gym tracking application.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Navigation />
        <div className="app-shell app-content">
          {children}
        </div>
      </body>
    </html>
  )
}
