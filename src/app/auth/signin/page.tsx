import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Commute Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            JSQ ↔ WTC · Personal commute optimizer
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="tap-target w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign in with GitHub
          </button>
        </form>
        <p className="text-xs text-muted-foreground">
          Access is restricted to authorized users.
        </p>
      </div>
    </div>
  );
}
