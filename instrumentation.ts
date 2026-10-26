export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Amplify's managed SSR runtime can differ from the build container.
    console.info("ReportBank Node.js runtime", { component: "next-ssr", node: process.versions.node });
  }
}
