// Downloads the OpenAPI document of a running Portal.BE into openapi/portal-api.json.
// Usage: npm run api:fetch   (then npm run api:generate)
import { writeFile } from "node:fs/promises";

const baseUrl = process.env.PORTAL_API_URL ?? "http://localhost:5128";
const url = `${baseUrl}/openapi/v1.json`;

const response = await fetch(url);
if (!response.ok) {
  console.error(`Could not download ${url}: HTTP ${response.status}. Is Portal.BE running?`);
  process.exit(1);
}

await writeFile(new URL("../openapi/portal-api.json", import.meta.url), await response.text());
console.log(`Saved ${url} to openapi/portal-api.json`);
