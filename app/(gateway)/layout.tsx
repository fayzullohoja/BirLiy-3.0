/**
 * Minimal layout for gateway/error screens (not-connected, subscription-blocked).
 * No navigation — just center-aligned content on clean background.
 */
export default function GatewayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      {children}
    </div>
  )
}
