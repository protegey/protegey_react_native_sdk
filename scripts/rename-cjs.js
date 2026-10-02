// tsc has no built-in way to emit a .cjs extension, so the CJS build lands in dist/cjs/*.js —
// this moves the single entry file to dist/index.cjs (matching package.json's "require" field)
// and removes the now-empty dist/cjs directory. Only index.cjs is published; internal modules
// stay bundled into it via the CJS build's own require() graph, which Node resolves fine within
// a single package.
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cjsDir = 'dist/cjs';

for (const file of readdirSync(cjsDir)) {
  if (file.endsWith('.js')) {
    const contents = readFileSync(join(cjsDir, file), 'utf8');
    const targetName = file === 'index.js' ? 'index.cjs' : file.replace(/\.js$/, '.cjs');
    writeFileSync(join('dist', targetName), contents.replace(/require\("\.\/([\w-]+)\.js"\)/g, 'require("./$1.cjs")'));
  }
}

rmSync(cjsDir, { recursive: true, force: true });
