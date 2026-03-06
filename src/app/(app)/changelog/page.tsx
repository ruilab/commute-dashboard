export const dynamic = "force-dynamic";

import { getAllChangelog } from "@/lib/actions/changelog";

const CATEGORY_ICONS: Record<string, string> = {
  feature: "✨",
  improvement: "🔧",
  fix: "🐛",
  data: "📊",
};

export default async function ChangelogPage() {
  const entries = await getAllChangelog();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Changelog</h1>
        <p className="text-sm text-muted-foreground">Product updates and improvements</p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No changelog entries yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span>{CATEGORY_ICONS[entry.category] || "📋"}</span>
                <span className="font-medium">{entry.title}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  v{entry.version}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {entry.body}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {new Date(entry.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
