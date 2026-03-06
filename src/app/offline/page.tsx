export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <span className="text-4xl">📡</span>
        <h1 className="text-xl font-semibold">You&apos;re Offline</h1>
        <p className="text-sm text-muted-foreground">
          Check your internet connection. The dashboard will reload
          automatically when you&apos;re back online.
        </p>
        <p className="text-xs text-muted-foreground">
          Check-in events recorded offline will sync when reconnected.
        </p>
      </div>
    </div>
  );
}
