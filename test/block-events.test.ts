import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Api, apiRequest } from '../src/api.js';
import { createLogger } from '../src/logger.js';
import { artifactId } from '../src/protocol.js';
import type { ApiResponse } from '../src/http.js';
import { buildLifecycleChain, buildReorgBranch, type LifecycleChain } from './fixtures/chain.js';
import { createHarness, testConfig, type Harness } from './fixtures/harness.js';

interface BlockEvents {
  schemaVersion: string;
  chain: string;
  network: string;
  protocols: string[];
  height: string;
  blockHash: string | null;
  indexed: boolean;
  checkpoint: { height: string; hash: string };
  events: Record<string, unknown>[];
  nextCursor: string | null;
  complete: boolean;
}

let fixture: LifecycleChain;
let harness: Harness;

async function get(path: string, query: Record<string, string> = {}, api: Api = harness.api): Promise<ApiResponse> {
  return api.handle(apiRequest('GET', path, { query }));
}

async function events(height: number, query: Record<string, string> = {}): Promise<BlockEvents> {
  const response = await get(`/v1/explorer/blocks/${height}/events`, query);
  assert.equal(response.status, 200);
  return response.body as BlockEvents;
}

before(async () => {
  fixture = buildLifecycleChain(testConfig().deployment);
  harness = createHarness({ chain: fixture.chain });
  harness.indexer.open();
  await harness.indexer.syncOnce();
});

after(() => harness.dispose());

describe('block events contract', () => {
  test('GET /v1/checkpoint reports the applied tip', async () => {
    const response = await get('/v1/checkpoint');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      chain: 'bitcoin',
      network: 'regtest',
      height: String(fixture.heights.tip),
      hash: harness.store.tipBlock()?.hash,
    });
  });

  test('a SEED block lists the creation with its carrier', async () => {
    const body = await events(fixture.heights.seedFounding);
    const idA = artifactId(fixture.txids['seedA'], 0);
    assert.equal(body.schemaVersion, 'universe-block-events-v1');
    assert.equal(body.chain, 'bitcoin');
    assert.equal(body.network, 'regtest');
    assert.deepEqual(body.protocols, ['patina']);
    assert.equal(body.height, String(fixture.heights.seedFounding));
    assert.equal(body.blockHash, harness.store.getBlock(fixture.heights.seedFounding)?.hash);
    assert.equal(body.indexed, true);
    assert.deepEqual(body.checkpoint, { height: String(fixture.heights.tip), hash: harness.store.tipBlock()?.hash });
    assert.equal(body.complete, true);
    assert.equal(body.nextCursor, null);
    const carrier = harness.store.getCarrier(fixture.txids['seedA'] as string, 0);
    assert.deepEqual(body.events, [
      {
        eventId: `created:${idA}:0`,
        protocolId: 'patina',
        txid: fixture.txids['seedA'],
        txIndex: 1,
        operation: 'mint',
        assetId: idA,
        ticker: null,
        displayName: null,
        assetKind: 'non-fungible',
        amountAtomic: null,
        decimals: null,
        fromAddress: null,
        toAddress: carrier?.address ?? null,
        inputOutpoint: null,
        outputOutpoint: `${fixture.txids['seedA']}:0`,
        inscriptionId: null,
      },
    ]);
  });

  test('carrier spends list moves and relics with the spent and successor outpoints', async () => {
    const idA = artifactId(fixture.txids['seedA'], 0);
    const idB = artifactId(fixture.txids['seedB'], 0);
    const idD = artifactId(fixture.txids['seedD'], 0);
    const bundle = await events(fixture.heights.bundle);
    assert.deepEqual(
      bundle.events.map((event) => [event['operation'], event['assetId'], event['inputOutpoint'], event['outputOutpoint']]),
      [
        ['transfer', idA, `${fixture.txids['seedA']}:0`, `${fixture.txids['bundle']}:0`],
        ['transfer', idB, `${fixture.txids['seedB']}:0`, `${fixture.txids['bundle']}:0`],
      ].sort((left, right) => String(left[1]).localeCompare(String(right[1]))),
    );
    const keep = await events(fixture.heights.keep);
    assert.deepEqual(new Set(keep.events.map((event) => event['outputOutpoint'])), new Set([`${fixture.txids['keep']}:1`]));
    assert.deepEqual(new Set(keep.events.map((event) => event['inputOutpoint'])), new Set([`${fixture.txids['bundle']}:0`]));

    const relic = await events(fixture.heights.relic);
    assert.equal(relic.events.length, 1);
    assert.equal(relic.events[0]?.['operation'], 'burn');
    assert.equal(relic.events[0]?.['assetId'], idD);
    assert.equal(relic.events[0]?.['txid'], fixture.txids['relic']);
    assert.equal(relic.events[0]?.['inputOutpoint'], `${fixture.txids['seedD']}:0`);
    assert.equal(relic.events[0]?.['outputOutpoint'], null);
    assert.equal(relic.events[0]?.['toAddress'], null);
  });

  test('every block lists exactly as many events as the reducer applied, and no rejected attempt', async () => {
    for (let height = fixture.startHeight; height <= fixture.heights.tip; height += 1) {
      const body = await events(height);
      assert.equal(body.events.length, harness.store.getBlock(height)?.event_count, `height ${height}`);
      assert.equal(body.complete, true, `height ${height}`);
    }
    assert.deepEqual((await events(fixture.heights.seedBelowMin)).events, []);
  });

  test('pages follow a stable opaque cursor bound to the height', async () => {
    const height = fixture.heights.bundle;
    const first = await events(height, { limit: '1' });
    assert.equal(first.events.length, 1);
    assert.equal(first.complete, false);
    assert.ok(first.nextCursor !== null);
    assert.equal((await events(height, { limit: '1' })).nextCursor, first.nextCursor);
    const second = await events(height, { limit: '1', cursor: first.nextCursor });
    assert.equal(second.events.length, 1);
    assert.notEqual(second.events[0]?.['eventId'], first.events[0]?.['eventId']);
    assert.equal(second.nextCursor, null);
    assert.equal(second.complete, true);
    const elsewhere = await get(`/v1/explorer/blocks/${fixture.heights.keep}/events`, { cursor: first.nextCursor });
    assert.equal(elsewhere.status, 400);
  });

  test('heights above the checkpoint are not indexed', async () => {
    const body = await events(fixture.heights.tip + 1);
    assert.equal(body.indexed, false);
    assert.deepEqual(body.events, []);
    assert.equal(body.nextCursor, null);
    assert.equal(body.complete, false);
    assert.equal(body.blockHash, null);
  });

  test('a height below the first applied block is never claimed complete', async () => {
    const body = await events(fixture.startHeight - 1);
    assert.equal(body.indexed, true);
    assert.equal(body.blockHash, null);
    assert.equal(body.complete, false);
  });

  test('malformed requests are rejected with 400', async () => {
    const height = fixture.heights.bundle;
    const cases: [string, Record<string, string>][] = [
      ['/v1/explorer/blocks/abc/events', {}],
      ['/v1/explorer/blocks/-1/events', {}],
      ['/v1/explorer/blocks/1.5/events', {}],
      ['/v1/explorer/blocks/12345678901/events', {}],
      [`/v1/explorer/blocks/${height}/events`, { limit: '0' }],
      [`/v1/explorer/blocks/${height}/events`, { limit: '501' }],
      [`/v1/explorer/blocks/${height}/events`, { limit: 'ten' }],
      [`/v1/explorer/blocks/${height}/events`, { cursor: 'not-a-cursor' }],
      [`/v1/explorer/blocks/${height}/events`, { cursor: Buffer.from('5|x').toString('base64url') }],
    ];
    for (const [path, query] of cases) {
      assert.equal((await get(path, query)).status, 400, `${path} ${JSON.stringify(query)}`);
    }
  });

  test('a service that is not ready answers 503', async () => {
    const api = new Api({
      config: harness.config,
      store: harness.store,
      metrics: harness.metrics,
      logger: createLogger('silent'),
      tipHeight: () => -1,
      tipHash: () => null,
    });
    assert.equal((await get(`/v1/explorer/blocks/${fixture.heights.bundle}/events`, {}, api)).status, 503);
    assert.equal((await get('/v1/checkpoint', {}, api)).status, 503);
  });
});

describe('block events across a reorg', () => {
  test('events of rolled back blocks are never returned', async () => {
    const config = testConfig();
    const chain = buildLifecycleChain(config.deployment);
    const local = createHarness({ chain: chain.chain });
    try {
      local.indexer.open();
      await local.indexer.syncOnce();
      const height = chain.heights.bundle;
      const before = (await local.api.handle(apiRequest('GET', `/v1/explorer/blocks/${height}/events`))).body as BlockEvents;
      assert.equal(before.events.length, 2);

      const forkHeight = height - 1;
      local.rpc.reorgTo(forkHeight, buildReorgBranch(chain, forkHeight, 6));
      await local.indexer.syncOnce();

      const response = await local.api.handle(apiRequest('GET', `/v1/explorer/blocks/${height}/events`));
      assert.equal(response.status, 200);
      const afterReorg = response.body as BlockEvents;
      assert.deepEqual(afterReorg.events, []);
      assert.equal(afterReorg.indexed, true);
      assert.equal(afterReorg.complete, true);
      assert.equal(afterReorg.blockHash, local.store.getBlock(height)?.hash);
      assert.notEqual(afterReorg.blockHash, before.blockHash);
      // The relic block was above the fork and is now above the checkpoint.
      const relic = (await local.api.handle(apiRequest('GET', `/v1/explorer/blocks/${chain.heights.relic}/events`))).body as BlockEvents;
      assert.equal(relic.indexed, false);
    } finally {
      local.dispose();
    }
  });
});
