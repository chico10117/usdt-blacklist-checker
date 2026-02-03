/*
 * Generates a Playwright storageState file using a headed browser.
 *
 * Intended flow:
 *  - Set BASE_URL (or E2E_AUTH_URL)
 *  - Run this script
 *  - Complete login (Google/Clerk/etc.) in the opened browser
 *  - Press ENTER in the terminal to save storageState
 */

const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { chromium } = require('@playwright/test');

function promptEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

(async () => {
  const baseUrl = process.env.BASE_URL || '';
  const authUrl = process.env.E2E_AUTH_URL || baseUrl;

  if (!authUrl) {
    console.error('Missing BASE_URL (or E2E_AUTH_URL). Example:');
    console.error('  BASE_URL="https://your-preview-url" node scripts/auth/generate-storage-state.js');
    process.exit(1);
  }

  const outputPath =
    process.env.E2E_STORAGE_STATE_PATH ||
    path.resolve(process.cwd(), '.auth', 'storageState.json');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Opening: ${authUrl}`);
  await page.goto(authUrl, { waitUntil: 'domcontentloaded' });

  console.log('\nComplete the login in the opened browser window.');
  await promptEnter('When you are DONE and see an authenticated page, press ENTER to save storageState... ');

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await context.storageState({ path: outputPath });

  await browser.close();

  console.log(`\n✅ Saved storageState to: ${outputPath}`);
  console.log('Now encode it and set it as the GitHub Secret E2E_STORAGE_STATE_B64.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
