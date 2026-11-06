// Builds layover-submission.zip from the files committed to git, so secrets and build output can never end up in it:
// no .env, no node_modules, no client/dist, no data/ (database and uploads), no logs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'layover-submission.zip');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const dirty = git('status', '--porcelain', '--untracked-files=no').trim();
if (dirty) {
  console.error('There are uncommitted changes. Commit them first, because the zip contains committed files only:\n' + dirty);
  process.exit(1);
}
if (fs.existsSync(out)) fs.rmSync(out);
git('archive', '--format=zip', '--prefix=layover/', '--output', out, 'HEAD');

const names = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean);
const banned = names.filter((n) => /(^|\/)\.env($|\.(?!example))|(^|\/)node_modules\/|(^|\/)dist\/|^data\/|\.log$/.test(n));
if (banned.length) {
  fs.rmSync(out);
  console.error('Refusing to package: these files are committed but must not be shipped:\n' + banned.join('\n'));
  process.exit(1);
}
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
console.log(`Created ${path.basename(out)} (${mb} MB, ${names.length} files). No .env, node_modules, data or logs inside.`);
