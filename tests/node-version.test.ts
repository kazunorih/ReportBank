import { describe, expect, it } from "vitest";
import { isSupportedNodeVersion } from "../scripts/check-node-version.mjs";

describe("Node.js security baseline", () => {
  it("rejects pre-fix and unsupported runtimes", () => {
    for (const version of ["24.18.0", "24.22.0", "22.23.3", "20.20.0", "26.12.1", "24.22.1-rc.1", "invalid"]) {
      expect(isSupportedNodeVersion(version)).toBe(false);
    }
  });
  it("accepts the patched LTS versions and later patches on the same lines", () => {
    for (const version of ["24.22.1", "v24.22.1", "24.22.2", "24.23.0", "22.23.4", "22.24.0"]) {
      expect(isSupportedNodeVersion(version)).toBe(true);
    }
  });
});
