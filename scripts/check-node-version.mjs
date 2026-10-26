import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// October 21, 2026 security releases. Only maintained LTS release lines are used.
export function isSupportedNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return (major === 24 && (minor > 22 || (minor === 22 && patch >= 1))) ||
    (major === 22 && (minor > 23 || (minor === 23 && patch >= 4)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!isSupportedNodeVersion(process.versions.node)) {
    console.error(`Node.js ${process.versions.node} is below the ReportBank security baseline. Use Node.js 24.22.1 or a newer 24.x LTS patch (22.23.4+ on 22.x is also supported). See docs/nodejs-security-response.md.`);
    process.exitCode = 1;
  }
}
