/*
 * Prints a base64-encoded storageState JSON to stdout.
 *
 * Usage:
 *   node scripts/auth/encode-storage-state.js [path/to/storageState.json]
 */

import fs from "node:fs";
import path from "node:path";

const defaultPath = path.resolve(process.cwd(), '.auth', 'storageState.json');
const filePath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultPath;

if (!fs.existsSync(filePath)) {
  console.error(`storageState file not found: ${filePath}`);
  process.exit(1);
}

const b64 = fs.readFileSync(filePath).toString('base64');
process.stdout.write(b64);
