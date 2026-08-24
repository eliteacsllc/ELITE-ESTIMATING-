import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const workflowDir = new URL('../.github/workflows/', import.meta.url);
const files = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
const failures = [];
let externalUses = 0;

for (const file of files) {
  const text = await readFile(new URL(file, workflowDir), 'utf8');
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (!match) continue;
    const target = match[1];
    if (target.startsWith('./') || target.startsWith('docker://')) continue;
    externalUses += 1;
    const at = target.lastIndexOf('@');
    const ref = at >= 0 ? target.slice(at + 1) : '';
    if (at <= 0 || !/^[0-9a-fA-F]{40}$/.test(ref)) {
      failures.push(`${file}:${index + 1}: ${target}`);
    }
  }
}

if (externalUses === 0) {
  console.error('No external GitHub Actions references were found; verifier may be misconfigured.');
  process.exit(1);
}

if (failures.length > 0) {
  console.error('Unpinned GitHub Actions detected. External actions must use immutable 40-character commit SHAs:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verified ${externalUses} external GitHub Action reference(s) across ${files.length} workflow file(s): all are commit-SHA pinned.`);
