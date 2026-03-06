import { BottomNav } from "@/components/ui/nav";
import { ChangelogBanner } from "@/components/changelog/changelog-modal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-20">
      <ChangelogBanner />
      <main className="p-4">{children}</main>
      <BottomNav />
    </div>
  );
}
