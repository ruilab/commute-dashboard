import { describe, it, expect } from "bun:test";
import { buildIssueTitle, buildIssueBody } from "../../src/lib/issue-format";

describe("buildIssueTitle", () => {
  it("prefixes with [Feature Request]", () => {
    expect(buildIssueTitle("Add dark mode")).toBe("[Feature Request] Add dark mode");
  });

  it("truncates long titles to 200 chars", () => {
    const long = "x".repeat(300);
    const result = buildIssueTitle(long);
    expect(result.length).toBeLessThanOrEqual(220); // prefix + 200
  });

  it("sanitizes HTML in title", () => {
    const result = buildIssueTitle("Test <script>alert(1)</script>");
    expect(result).not.toContain("<script>");
  });

  it("escapes markdown heading injection", () => {
    const result = buildIssueTitle("# Fake heading");
    expect(result).toContain("\\#");
  });
});

describe("buildIssueBody", () => {
  const base = {
    title: "Test feature",
    description: "A description of the feature that is at least 10 chars.",
    category: "general",
    submittedBy: "testuser",
  };

  it("contains Summary section", () => {
    const body = buildIssueBody(base);
    expect(body).toContain("## Summary");
  });

  it("contains Details table", () => {
    const body = buildIssueBody(base);
    expect(body).toContain("## Details");
    expect(body).toContain("| Category | general |");
    expect(body).toContain("| Submitted by | testuser |");
  });

  it("contains timestamp", () => {
    const body = buildIssueBody(base);
    expect(body).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("sanitizes HTML in description", () => {
    const body = buildIssueBody({
      ...base,
      description: "Hello <img src=x onerror=alert(1)> world with enough text",
    });
    expect(body).not.toContain("<img");
  });

  it("escapes markdown link injection", () => {
    const body = buildIssueBody({
      ...base,
      description: "Check [this link](http://evil.com) for more info about it",
    });
    expect(body).not.toContain("[this link]");
    expect(body).toContain("\\[this link\\]");
  });

  it("escapes heading injection in description", () => {
    const body = buildIssueBody({
      ...base,
      description: "# Fake heading\n## Another fake\nNormal text that follows",
    });
    // The # should be escaped in the Summary section
    expect(body).toContain("\\#");
  });

  it("truncates long descriptions", () => {
    const body = buildIssueBody({
      ...base,
      description: "x".repeat(3000),
    });
    expect(body.length).toBeLessThan(3000);
  });
});
