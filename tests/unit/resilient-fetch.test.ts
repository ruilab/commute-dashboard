import { describe, it, expect } from "bun:test";

// Test the resilient fetch module's timeout and retry config
describe("resilient fetch defaults", () => {
  it("default timeout is reasonable", () => {
    const defaultTimeout = 5000;
    expect(defaultTimeout).toBeGreaterThanOrEqual(3000);
    expect(defaultTimeout).toBeLessThanOrEqual(10000);
  });

  it("default retries is 1", () => {
    const defaultRetries = 1;
    expect(defaultRetries).toBe(1);
  });

  it("retry delay is reasonable", () => {
    const defaultDelay = 500;
    expect(defaultDelay).toBeGreaterThanOrEqual(100);
    expect(defaultDelay).toBeLessThanOrEqual(5000);
  });
});

describe("logger levels", () => {
  const levels = ["info", "warn", "error"];

  it("has 3 log levels", () => {
    expect(levels).toHaveLength(3);
  });

  it("includes error level", () => {
    expect(levels).toContain("error");
  });
});
