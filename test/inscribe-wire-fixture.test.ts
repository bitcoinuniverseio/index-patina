import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { apiRequest } from '../src/api.js';
import { artifactId } from '../src/protocol.js';
import { buildLifecycleChain } from './fixtures/chain.js';
import { createHarness, testConfig } from './fixtures/harness.js';

/** Controlled real Store -> reducer -> Api serialization, never network acceptance. */
test('exports the exact indexer wire surface consumed by Inscribe', async () => {
  const fixture = buildLifecycleChain(testConfig().deployment);
  const harness = createHarness({ chain: fixture.chain });
  try {
    harness.indexer.open();
    await harness.indexer.syncOnce();
    const id = artifactId(fixture.txids['seedA'], 0);
    const relicId = artifactId(fixture.txids['seedD'], 0);
    const address = harness.store.getArtifactRow(id)?.carrier_address;
    assert.ok(address);
    const reads: Array<{ appPath: string; indexerPath: string; query: Record<string, string>; status: number; payload: unknown }> = [];
    async function capture(appPath: string, indexerPath = appPath, query: Record<string, string> = {}) {
      const response = await harness.api.handle(apiRequest('GET', indexerPath, { query }));
      assert.equal(response.status, 200, indexerPath);
      const entry = { appPath, indexerPath, query, status: response.status, payload: JSON.parse(JSON.stringify(response.body)) as unknown };
      reads.push(entry);
      return entry.payload as Record<string, unknown>;
    }
    await capture('/patina/status');
    await capture('/patina/window');
    const page = await capture('/patina/artifacts', '/patina/artifacts', { limit: '2' });
    assert.equal(typeof page['next_cursor'], 'string');
    await capture('/patina/artifacts', '/patina/artifacts', { limit: '2', cursor: page['next_cursor'] as string });
    await capture('/patina/artifacts', '/patina/artifacts', { status: 'ALIVE', founding: 'true', limit: '10' });
    await capture('/patina/artifacts', '/patina/artifacts', { status: 'RELIC', limit: '10' });
    await capture(`/patina/artifacts/${id}`);
    await capture(`/patina/artifacts/${relicId}`);
    await capture('/patina/census', '/patina/census/current');
    await capture('/patina/census?epoch=0', '/patina/census/0');
    await capture('/patina/museum');
    await capture('/patina/leaderboard?scope=all', '/patina/leaderboard', { scope: 'all' });
    await capture('/patina/leaderboard?scope=founding', '/patina/leaderboard', { scope: 'founding' });
    await capture('/patina/shatter?limit=10', '/patina/shatter', { limit: '10' });
    await capture('/patina/invalid-events', '/patina/invalid-events', { limit: '10' });
    await capture('/patina/invalid-events', '/patina/invalid-events', { reason: 'SEED_COMMIT_TOO_YOUNG', limit: '10' });
    await capture('/patina/stats');
    // The raw holdings route is intentionally unpaged. Inscribe uses the
    // existing ALIVE/address artifact page to offer bounded holdings reads.
    const rawHoldings = await harness.api.handle(apiRequest('GET', `/patina/addresses/${address}/holdings`));
    assert.equal(rawHoldings.status, 200);
    const holdings = await capture(`/patina/addresses/${address}/holdings`, '/patina/artifacts', { address, status: 'ALIVE', limit: '1' });
    assert.equal(typeof holdings['next_cursor'], 'string');
    await capture(`/patina/addresses/${address}/holdings`, '/patina/artifacts', { address, status: 'ALIVE', limit: '1', cursor: holdings['next_cursor'] as string });
    const output = process.env['PATINA_WIRE_FIXTURE_OUTPUT'];
    if (output) {
      const destination = resolve(output);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, JSON.stringify({
        sourceRepository: 'bitcoinuniverseio/index-patina',
        sourceGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
        specSha256: harness.config.deployment.specSha256,
        evidenceKind: 'controlled-indexer-store-api-fixture',
        network: harness.config.network,
        indexedHeight: fixture.heights.tip,
        rawHoldings: rawHoldings.body,
        reads,
      }, null, 2) + '\n');
    }
    assert.equal(reads.length, 19);
  } finally { harness.dispose(); }
});
