import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { packedFile, verifySpecification } from './verify-vendor.mjs';

const bytes = readFileSync(new URL('../vendor/bitcoinuniverse-patina-1.1.0.tgz', import.meta.url));
const provenance = JSON.parse(readFileSync(new URL('../SOURCE-PROVENANCE.json', import.meta.url), 'utf8'));

test('packed specification bytes match source provenance, deployments and vectors', () => {
  verifySpecification(bytes, provenance.consensusSurface.vendoredTarball.specSha256);
});

test('matching metadata cannot hide changed specification bytes', () => {
  assert.throws(() => verifySpecification(bytes, '00'.repeat(32)), /specification bytes/);
});

function archive(entries) {
  return gzipSync(Buffer.concat(entries.flatMap(([name, value]) => {
    const body = Buffer.from(value);
    const header = Buffer.alloc(512);
    header.write(name);
    header.write(body.length.toString(8).padStart(11, '0'), 124);
    return [header, body, Buffer.alloc((512 - body.length % 512) % 512)];
  })));
}

test('stale deployment identity is rejected even with matching source and vectors', () => {
  const spec = 'spec\n';
  const hash = createHash('sha256').update(spec).digest('hex');
  const stale = archive([
    ['package/patina-protocol.md', spec],
    ['package/deployments/regtest.json', JSON.stringify({ spec_sha256: '00'.repeat(32) })],
  ]);
  assert.throws(() => verifySpecification(stale, hash), /regtest deployment/);
});

test('missing and truncated archive entries fail', () => {
  assert.throws(() => packedFile(bytes, 'package/missing'), /missing/);
  const header = Buffer.alloc(512);
  header.write('package/patina-protocol.md');
  header.write('00000000010', 124);
  assert.throws(() => packedFile(gzipSync(header), 'package/patina-protocol.md'), /truncated/);
});
