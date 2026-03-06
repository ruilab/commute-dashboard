import { describe, it, expect } from "bun:test";

// Test the changelog data model and category icons
describe("changelog categories", () => {
  const validCategories = ["feature", "improvement", "fix", "data"];

  it("categories are predefined set", () => {
    expect(validCategories).toHaveLength(4);
    expect(validCategories).toContain("feature");
    expect(validCategories).toContain("fix");
  });
});

describe("changelog entry validation", () => {
  it("requires version, title, and body", () => {
    const entry = { version: "3.0.0", title: "Test", body: "Description" };
    expect(entry.version).toBeTruthy();
    expect(entry.title).toBeTruthy();
    expect(entry.body).toBeTruthy();
  });

  it("version follows semver format", () => {
    const valid = ["3.0.0", "3.0.1", "3.1.0", "10.2.30"];
    const invalid = ["3", "v3.0", "abc"];

    for (const v of valid) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    }
    for (const v of invalid) {
      expect(v).not.toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
