import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/signin-form";

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect("/");

  const requireCode = !!process.env.SIGNUP_CODE;

  async function handleSignIn(code?: string) {
    "use server";
    const expected = process.env.SIGNUP_CODE;
    if (expected && code !== expected) {
      throw new Error("Invalid signup code");
    }
    await signIn("github", { redirectTo: "/" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Commute Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            JSQ ↔ WTC · Personal commute optimizer
          </p>
        </div>
        <SignInForm requireCode={requireCode} onSignIn={handleSignIn} />
      </div>
    </div>
  );
}
