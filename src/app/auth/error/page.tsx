import Link from "next/link";

export default function AuthError() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          Your GitHub account is not authorized to access this app.
        </p>
        <Link
          href="/auth/signin"
          className="tap-target inline-block rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}
