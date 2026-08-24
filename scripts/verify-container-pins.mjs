import { readFile } from 'node:fs/promises';

const digestPattern = /@sha256:[0-9a-f]{64}$/i;
const failures = [];

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
for (const [index, line] of dockerfile.split(/\r?\n/).entries()) {
  const match = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i);
  if (!match) continue;
  const image = match[1];
  if (image.toLowerCase() === 'scratch') continue;
  if (!digestPattern.test(image)) failures.push(`Dockerfile:${index + 1}: unpinned FROM ${image}`);
}

const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
for (const [index, line] of compose.split(/\r?\n/).entries()) {
  const match = line.match(/^\s*image:\s*([^\s#]+)/i);
  if (!match) continue;
  const image = match[1].replace(/^['"]|['"]$/g, '');
  if (!digestPattern.test(image)) failures.push(`docker-compose.yml:${index + 1}: unpinned image ${image}`);
}

const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
for (const [index, line] of ci.split(/\r?\n/).entries()) {
  const service = line.match(/^\s*image:\s*([^\s#]+)/i);
  if (service) {
    const image = service[1].replace(/^['"]|['"]$/g, '');
    if (!digestPattern.test(image)) failures.push(`.github/workflows/ci.yml:${index + 1}: unpinned service image ${image}`);
  }
  if (/\bdocker\s+run\b/.test(line)) {
    const images = [...line.matchAll(/\b[a-z0-9][a-z0-9._/-]*:[a-z0-9._-]+(?:@sha256:[0-9a-f]{64})?/gi)].map((match) => match[0]);
    for (const image of images) {
      if (!digestPattern.test(image)) failures.push(`.github/workflows/ci.yml:${index + 1}: unpinned docker run image ${image}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Unpinned container image references detected. Production/CI images must use immutable sha256 digests:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Verified Dockerfile, Compose, CI service, and CI docker-run container references are digest pinned.');
