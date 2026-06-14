import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const targetUrl = process.argv[2] ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const outputDir = path.resolve("screenshots", "playwright");
const outputFile = path.join(outputDir, `gaveteira-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
const channel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";

async function ensureServerIsReachable(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok || response.status < 500) {
      return;
    }
  } catch {
    // Give the browser one more chance below so redirects and dev-server quirks still work.
  }
}

await ensureServerIsReachable(targetUrl);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.screenshot({ path: outputFile, fullPage: true });
  console.log(outputFile);
} finally {
  await browser.close();
}
