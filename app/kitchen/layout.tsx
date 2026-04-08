'use client'

import { KitchenSessionProvider } from './_context/KitchenSessionContext'

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <KitchenSessionProvider>
      <div className="min-h-screen bg-surface-muted">
        {children}
      </div>
    </KitchenSessionProvider>
  )
}
