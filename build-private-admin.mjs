import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'private-admin/src');
const output = path.join(root, 'private-admin/out');
const files = ['index.html', 'app.js', 'config.js', 'style.css'];

// This directory is generated; remove obsolete build files before packaging.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(path.join(source, file), path.join(output, file));
if ((await readdir(output)).sort().join() !== [...files].sort().join()) {
  throw Error('Private admin output contains an unexpected file');
}
console.log(`Private admin: ${files.length} allowlisted files written to ${output}`);
