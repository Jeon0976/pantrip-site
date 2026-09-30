import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'out');
const files = ['index.html', 'style.css', 'app.js', 'config.js', 'assets', 'legal.css',
  'privacy.html', 'privacy', 'support.html', 'support', 'terms.html', 'terms'];
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await cp(path.join(root, 'public', file), path.join(output, file), { recursive: true });
if ((await readdir(output)).sort().join() !== [...files].sort().join()) {
  throw Error('Public output contains an unexpected file');
}
console.log('Public site built without admin or API documentation');
