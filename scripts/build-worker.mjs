import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  absWorkingDir: projectRoot,
  entryPoints: ["workers/stripe-webhook/index.ts"],
  outfile: path.join(projectRoot, "dist/stripe-webhook-worker/index.js"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  tsconfigRaw: {
    compilerOptions: {
      baseUrl: projectRoot,
      paths: { "@/*": ["./*"] },
    },
  },
});
