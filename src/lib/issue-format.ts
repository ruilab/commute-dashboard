/**
 * GitHub issue body builder for feature requests.
 * Produces consistent, well-structured Markdown with safe escaping.
 */

/**
 * Sanitize user input for safe Markdown embedding.
 * Prevents Markdown injection (fake headings, link injection, HTML tags).
 */
function sanitize(input: string): string {
  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, "")
    // Escape leading # that could create fake headings
    .replace(/^(#+)/gm, "\\$1")
    // Escape [ ] that could create fake links
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    // Trim excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface FeatureRequestInput {
  title: string;
  description: string;
  category: string;
  submittedBy: string;
}

export function buildIssueTitle(title: string): string {
  const clean = sanitize(title).slice(0, 200);
  return `[Feature Request] ${clean}`;
}

export function buildIssueBody(input: FeatureRequestInput): string {
  const desc = sanitize(input.description).slice(0, 2000);
  const cat = sanitize(input.category).slice(0, 50);
  const user = sanitize(input.submittedBy).slice(0, 100);
  const now = new Date().toISOString();

  return [
    `## Summary`,
    ``,
    desc,
    ``,
    `## Details`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Category | ${cat} |`,
    `| Submitted by | ${user} |`,
    `| Timestamp | ${now} |`,
    `| Source | commute-dashboard app |`,
    ``,
    `---`,
    `*Auto-filed via commute-dashboard feature request flow.*`,
  ].join("\n");
}
