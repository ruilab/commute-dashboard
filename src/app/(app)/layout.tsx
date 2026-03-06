import { BottomNav } from "@/components/ui/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-20">
      <main className="p-4">{children}</main>
      <BottomNav />
    </div>
  );
}
