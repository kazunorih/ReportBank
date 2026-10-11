// Amplify exposes build variables separately from Next.js SSR variables.
// Write only the two non-secret settings required by the report reader.
import fs from "node:fs";

const table = process.env.WEEKLY_REPORTS_TABLE_NAME;
if (table) {
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(table)) throw new Error("Invalid report table name");
  const region = process.env.APP_AWS_REGION || "ap-northeast-1";
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region)) throw new Error("Invalid AWS region");
  const filename = ".env.production";
  let content = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  for (const [name, value] of Object.entries({ WEEKLY_REPORTS_TABLE_NAME: table, APP_AWS_REGION: region })) {
    content = content.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, "gm"), "");
    content = `${content.trimEnd()}\n${name}=${value}\n`;
  }
  fs.writeFileSync(filename, content);
}
