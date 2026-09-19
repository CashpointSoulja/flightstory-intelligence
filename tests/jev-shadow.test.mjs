import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { runJevShadow, shadowLogLine, topicsFromAnswer, primaryTopicsFromAnswer, JEV_PRIMARY_MIN_PROBABILITY, JEV_TIMEOUT_MS, NONE_OPTION } from '../jev-shadow.mjs';

const labels = ['sleep', 'brain', 'love'];
const choice = (pick, probabilities) => ({ answers: { topic: { type: 'choice', choice: pick, probabilities } } });
const gatewayOk = body => async () => new Response(JSON.stringify(body), { status: 200 });

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const post = (url, query) => fetch(`${url}/api/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
// The shadow is deliberately not awaited before the response, so tests wait for its line.
async function waitForLines(lines, count, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (lines.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  return lines.map(line => JSON.parse(line));
}
// Routes free-text to the topic map: no demo excerpts, so the nano router runs.
const demoOptions = extra => ({ loadDemo: async () => null, mode: 'demo', openAIKey: 'test-key', ...extra });
const nanoReturns = (topics, calls = []) => async (_url, options) => {
  calls.push(JSON.parse(options.body).text.format.name);
  return new Response(JSON.stringify({ output_text: JSON.stringify({ topics }) }), { status: 200 });
};

test('jev shadow keeps the labels the model ranked above its abstain option', () => {
  assert.deepEqual(topicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.7, brain: 0.2, love: 0.05, [NONE_OPTION]: 0.05 } }, labels), ['sleep', 'brain']);
  // Everything at or below the abstain option means the router declines, like nano's [].
  assert.deepEqual(topicsFromAnswer({ type: 'choice', choice: NONE_OPTION, probabilities: { sleep: 0.1, brain: 0.1, love: 0.1, [NONE_OPTION]: 0.7 } }, labels), []);
  // Never more than the three the nano router is capped at.
  assert.equal(topicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.4, brain: 0.3, love: 0.2, [NONE_OPTION]: 0.1 } }, labels).length, 3);
});

test('jev shadow rejects any output outside the existing topic inventory', () => {
  const outside = { type: 'choice', choice: 'cryptocurrency', probabilities: { cryptocurrency: 0.9, [NONE_OPTION]: 0.1 } };
  assert.equal(topicsFromAnswer(outside, labels), null);
  // A valid pick is not rescued by an invented option elsewhere in the distribution.
  assert.equal(topicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.8, cryptocurrency: 0.2 } }, labels), null);
  for (const malformed of [null, undefined, {}, { type: 'boolean', probability: 0.9 }, { type: 'choice', choice: 'sleep' },
    { type: 'choice', choice: 'sleep', probabilities: { sleep: 'high' } }, { type: 'choice', choice: 'sleep', probabilities: { sleep: NaN } },
    { type: 'choice', choice: 42, probabilities: { sleep: 1 } }, { type: 'choice', choice: 'sleep', probabilities: [] }]) {
    assert.equal(topicsFromAnswer(malformed, labels), null, `expected rejection for ${JSON.stringify(malformed)}`);
  }
});

test('jev shadow reports an invalid label as a failure instead of a route', async () => {
  const result = await runJevShadow('how do I sleep better', labels, {
    apiKey: 'gateway-key',
    fetchImpl: gatewayOk(choice('cryptocurrency', { cryptocurrency: 0.9, [NONE_OPTION]: 0.1 }))
  });
  assert.deepEqual(result.topics, []);
  assert.equal(result.error, 'invalid-output');
});

test('jev shadow makes no network call and reports no-key when the gateway key is absent', async () => {
  let calls = 0;
  const result = await runJevShadow('how do I sleep better', labels, { apiKey: '', fetchImpl: async () => { calls++; return new Response('{}'); } });
  assert.equal(calls, 0);
  assert.equal(result.error, 'no-key');
  assert.deepEqual(result.topics, []);
  assert.equal(result.latencyMs, 0);
});

test('jev shadow aborts on its own deadline and reports a timeout', async () => {
  assert.equal(JEV_TIMEOUT_MS, 650);
  let aborted = false;
  const result = await runJevShadow('how do I sleep better', labels, {
    apiKey: 'gateway-key',
    timeoutMs: 25,
    fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => {
      aborted = true;
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }))
  });
  assert.equal(aborted, true);
  assert.equal(result.error, 'timeout');
  assert.deepEqual(result.topics, []);
});

test('jev shadow turns a non-2xx gateway response into a recorded failure', async () => {
  const result = await runJevShadow('how do I sleep better', labels, {
    apiKey: 'bad-key',
    fetchImpl: async () => new Response('unauthorized', { status: 401 })
  });
  assert.equal(result.error, 'http-401');
  assert.deepEqual(result.topics, []);
});

test('jev shadow sends the query as state and the topic inventory as choice criteria', async () => {
  let sent;
  await runJevShadow('how do I stop waking up exhausted', labels, {
    apiKey: 'gateway-key',
    fetchImpl: async (url, options) => {
      sent = { url, body: JSON.parse(options.body) };
      return new Response(JSON.stringify(choice('sleep', { sleep: 1, [NONE_OPTION]: 0 })), { status: 200 });
    }
  });
  assert.equal(sent.url, 'https://ai-gateway.vercel.sh/v1/evaluate');
  assert.equal(sent.body.model, 'typesafe-ai/jev');
  assert.equal(sent.body.state.search, 'how do I stop waking up exhausted');
  assert.equal(sent.body.questions.topic.type, 'choice');
  assert.deepEqual(Object.keys(sent.body.questions.topic.criteria).sort(), [NONE_OPTION, ...labels].sort());
});

test('jev shadow log line hashes the query and records both routers', () => {
  const agree = JSON.parse(shadowLogLine({ query: 'how do I stop waking up exhausted', nano: ['sleep'], jev: ['sleep'], nanoMs: 410, jevMs: 88 }));
  assert.equal(agree.evt, 'jev-shadow');
  assert.equal(agree.agreement, true);
  assert.equal(agree.overlap, 1);
  assert.equal(agree.top1, true);
  assert.equal(agree.nanoMs, 410);
  assert.equal(agree.jevMs, 88);
  assert.equal(agree.error, null);
  // The raw query never reaches the log.
  assert.equal(agree.q.length, 16);
  assert.equal(shadowLogLine({ query: 'how do I stop waking up exhausted', nano: [], jev: [], nanoMs: 1, jevMs: 1 }).includes('waking'), false);

  const partial = JSON.parse(shadowLogLine({ query: 'q', nano: ['sleep', 'brain'], jev: ['sleep'], nanoMs: 1, jevMs: 2 }));
  assert.equal(partial.agreement, false, 'a subset is not agreement');
  assert.equal(partial.overlap, 1);
  assert.equal(partial.top1, true, 'top1 is recorded separately so it can be recomputed offline');

  const both = JSON.parse(shadowLogLine({ query: 'q', nano: [], jev: [], nanoMs: 1, jevMs: 0, error: 'no-key' }));
  assert.equal(both.agreement, true, 'both routers declining is agreement');
  assert.equal(both.error, 'no-key');
  assert.equal(shadowLogLine({ query: 'q', nano: [], jev: [], nanoMs: 1, jevMs: 1 }).includes('\n'), false, 'log stays single-line');
});

test('enabled jev shadow scores alongside the nano router without changing the answer', async () => {
  const lines = [];
  const nanoCalls = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep'], nanoCalls),
    jev: { enabled: true, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: gatewayOk(choice('sleep', { sleep: 0.95, brain: 0.02, [NONE_OPTION]: 0.03 })) }
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    // Unchanged from the nano-only behaviour asserted in server.test.mjs.
    assert.equal(result.mode, 'ai-topic-map');
    assert.ok(result.citations.every(citation => citation.guest === 'sleep'));
    const [log] = await waitForLines(lines, 1);
    assert.deepEqual(log.nano, ['sleep']);
    assert.deepEqual(log.jev, ['sleep']);
    assert.equal(log.agreement, true);
    assert.equal(log.error, null);
    assert.equal(typeof log.nanoMs, 'number');
    assert.equal(typeof log.jevMs, 'number');
  });
});

test('enabled jev shadow records disagreement and still serves the nano result', async () => {
  const lines = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: { enabled: true, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: gatewayOk(choice('brain', { brain: 0.88, sleep: 0.07, [NONE_OPTION]: 0.05 })) }
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.ok(result.citations.every(citation => citation.guest === 'sleep'), 'jev disagreeing must not leak into the response');
    const [log] = await waitForLines(lines, 1);
    assert.deepEqual(log.nano, ['sleep']);
    assert.deepEqual(log.jev, ['brain', 'sleep']);
    assert.equal(log.agreement, false);
    assert.equal(log.overlap, 1);
    assert.equal(log.top1, false);
  });
});

test('a jev shadow timeout is logged and never delays or alters the response', async () => {
  const lines = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: {
      enabled: true, apiKey: 'gateway-key', timeoutMs: 25, log: line => lines.push(line),
      fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
    }
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.equal(result.mode, 'ai-topic-map');
    assert.ok(result.citations.length > 0);
    const [log] = await waitForLines(lines, 1);
    assert.equal(log.error, 'timeout');
    assert.deepEqual(log.jev, []);
    assert.deepEqual(log.nano, ['sleep']);
  });
});

test('a missing gateway key logs no-key and issues no gateway request', async () => {
  const lines = [];
  let gatewayCalls = 0;
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: { enabled: true, apiKey: '', timeoutMs: 650, log: line => lines.push(line), fetchImpl: async () => { gatewayCalls++; return new Response('{}'); } }
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.equal(result.mode, 'ai-topic-map');
    const [log] = await waitForLines(lines, 1);
    assert.equal(log.error, 'no-key');
    assert.equal(gatewayCalls, 0);
  });
});

test('the jev shadow fires exactly once per nano topic route, and not otherwise', async () => {
  const lines = [];
  const nanoCalls = [];
  let gatewayCalls = 0;
  const shadowFetch = async () => { gatewayCalls++; return new Response(JSON.stringify(choice('sleep', { sleep: 0.95, [NONE_OPTION]: 0.05 })), { status: 200 }); };
  // No OpenAI key: the nano router short-circuits to [] without routing, so there is
  // nothing to shadow and the gateway must stay untouched.
  await withServer(demoOptions({ openAIKey: '', jev: { enabled: true, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: shadowFetch } }), async url => {
    assert.equal((await (await post(url, 'sleep')).json()).mode, 'topic-map');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(gatewayCalls, 0, 'no route, no shadow');
    assert.equal(lines.length, 0);
  });
  // With a key the shadow is 1:1 with the router: one line per routed request.
  await withServer(demoOptions({ fetchImpl: nanoReturns(['sleep'], nanoCalls), jev: { enabled: true, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: shadowFetch } }), async url => {
    await (await post(url, 'how do I stop waking up exhausted')).json();
    await (await post(url, 'how do I stop waking up exhausted')).json();
    await waitForLines(lines, nanoCalls.length);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(gatewayCalls, nanoCalls.length);
    assert.equal(lines.length, nanoCalls.length);
  });
});

test('JEV_ENABLED=false is a no-op: no gateway call, no log, identical response', async () => {
  let gatewayCalls = 0;
  const lines = [];
  const disabledJev = { enabled: false, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: async () => { gatewayCalls++; return new Response('{}'); } };
  let baseline;
  await withServer(demoOptions({ fetchImpl: nanoReturns(['sleep']) }), async url => {
    baseline = await (await post(url, 'how do I stop waking up exhausted')).json();
  });
  await withServer(demoOptions({ fetchImpl: nanoReturns(['sleep']), jev: disabledJev }), async url => {
    const response = await post(url, 'how do I stop waking up exhausted');
    assert.deepEqual(await response.json(), baseline, 'the disabled shadow must not change the response');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(gatewayCalls, 0);
    assert.equal(lines.length, 0);
  });
});

test('jev primary keeps only labels above the absolute probability floor', () => {
  assert.equal(JEV_PRIMARY_MIN_PROBABILITY, 0.25);
  // 0.2 clears the abstain option but not the serving floor, so it is not routed.
  assert.deepEqual(primaryTopicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.7, brain: 0.2, love: 0.05, [NONE_OPTION]: 0.05 } }, labels), ['sleep']);
  assert.deepEqual(primaryTopicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.4, brain: 0.35, love: 0.2, [NONE_OPTION]: 0.05 } }, labels), ['sleep', 'brain']);
  // Ordered by probability, not by the order the gateway happened to serialise.
  assert.deepEqual(primaryTopicsFromAnswer({ type: 'choice', choice: 'love', probabilities: { sleep: 0.26, brain: 0.3, love: 0.44 } }, labels), ['love', 'brain', 'sleep']);
  // Never more than the three the nano router is capped at.
  assert.equal(primaryTopicsFromAnswer({ type: 'choice', choice: 'sleep', probabilities: { sleep: 0.25, brain: 0.25, love: 0.25, money: 0.25 } }, [...labels, 'money']).length, 3);
});

test('jev primary abstains when the none option wins, and rejects malformed answers', () => {
  assert.deepEqual(primaryTopicsFromAnswer({ type: 'choice', choice: NONE_OPTION, probabilities: { sleep: 0.3, brain: 0.1, [NONE_OPTION]: 0.6 } }, labels), []);
  // A tie is not a win for any label either: the router declines rather than guess.
  assert.deepEqual(primaryTopicsFromAnswer({ type: 'choice', choice: NONE_OPTION, probabilities: { sleep: 0.5, [NONE_OPTION]: 0.5 } }, labels), []);
  // Abstaining is a valid answer; only structurally bad output is a failure.
  assert.equal(primaryTopicsFromAnswer({ type: 'choice', choice: 'cryptocurrency', probabilities: { cryptocurrency: 0.9 } }, labels), null);
  assert.equal(primaryTopicsFromAnswer({ type: 'boolean', probability: 0.9 }, labels), null);
  assert.equal(primaryTopicsFromAnswer(null, labels), null);
});

test('jev primary mode maps probabilities through runJevShadow and reports failures unchanged', async () => {
  const served = await runJevShadow('how do I sleep better', labels, {
    apiKey: 'gateway-key', mode: 'primary',
    fetchImpl: gatewayOk(choice('sleep', { sleep: 0.6, brain: 0.24, [NONE_OPTION]: 0.16 }))
  });
  assert.deepEqual(served.topics, ['sleep'], 'the primary floor applies, not the shadow ranking');
  assert.equal(served.error, null);
  const abstained = await runJevShadow('who won the league', labels, {
    apiKey: 'gateway-key', mode: 'primary',
    fetchImpl: gatewayOk(choice(NONE_OPTION, { sleep: 0.2, [NONE_OPTION]: 0.8 }))
  });
  assert.deepEqual(abstained.topics, [], 'abstaining is a route of zero labels, not an error');
  assert.equal(abstained.error, null);
});

// Primary-mode server wiring: nano's mock always answers ['sleep'], so any other routed
// label in the response can only have come from Jev.
const primaryJev = extra => ({ enabled: true, mode: 'primary', apiKey: 'gateway-key', timeoutMs: 650, ...extra });

test('jev primary serves its own labels and logs its decision with probabilities immediately', async () => {
  const lines = [];
  const nanoCalls = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep'], nanoCalls),
    jev: primaryJev({ log: line => lines.push(line), fetchImpl: gatewayOk(choice('brain', { brain: 0.6, love: 0.3, sleep: 0.05, [NONE_OPTION]: 0.05 })) })
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.equal(result.mode, 'ai-topic-map');
    assert.ok(result.citations.length > 0);
    assert.ok(result.citations.every(citation => ['brain', 'love'].includes(citation.guest)), 'jev decides the route in primary mode');
    const [log] = await waitForLines(lines, 1);
    assert.equal(log.mode, 'primary');
    assert.equal(log.decided, 'jev');
    assert.deepEqual(log.jev, ['brain', 'love'], 'sleep at 0.05 is below the serving floor');
    assert.deepEqual(log.jevProbs, { brain: 0.6, love: 0.3 }, 'served labels carry their belief mass for audit');
    // Serverless freezes the instance at response end, so a success-path comparison
    // chained on nano would never be written; nano fields are null, not awaited.
    assert.equal(log.nano, null);
    assert.equal(log.agreement, null);
    assert.equal(log.error, null);
    assert.equal(nanoCalls.length, 1, 'nano still starts in parallel as the instant fallback');
  });
});

test('jev primary abstaining serves zero labels instead of the nano route', async () => {
  const lines = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: primaryJev({ log: line => lines.push(line), fetchImpl: gatewayOk(choice(NONE_OPTION, { sleep: 0.2, brain: 0.1, [NONE_OPTION]: 0.7 })) })
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.notEqual(result.mode, 'ai-topic-map', 'an abstain must not be served as an AI topic route');
    const [log] = await waitForLines(lines, 1);
    assert.deepEqual(log.jev, []);
    assert.equal(log.decided, 'jev', 'abstaining is jev deciding, not a fallback');
    assert.equal(log.error, null);
  });
});

test('a jev primary timeout falls back to the nano route on the same deadline', async () => {
  const lines = [];
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: primaryJev({
      timeoutMs: 25, log: line => lines.push(line),
      fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
    })
  }), async url => {
    const result = await (await post(url, 'how do I stop waking up exhausted')).json();
    assert.equal(result.mode, 'ai-topic-map');
    assert.ok(result.citations.every(citation => citation.guest === 'sleep'), 'nano decides when jev times out');
    const [log] = await waitForLines(lines, 1);
    assert.equal(log.mode, 'primary');
    assert.equal(log.error, 'timeout');
    assert.equal(log.decided, 'nano');
    assert.deepEqual(log.jev, []);
    assert.deepEqual(log.nano, ['sleep']);
  });
});

test('jev primary falls back to nano on invalid output, a gateway error, and a missing key', async () => {
  const cases = [
    { name: 'invalid-output', jev: { fetchImpl: gatewayOk(choice('cryptocurrency', { cryptocurrency: 0.9, [NONE_OPTION]: 0.1 })) } },
    { name: 'http-500', jev: { fetchImpl: async () => new Response('boom', { status: 500 }) } },
    { name: 'no-key', jev: { apiKey: '', fetchImpl: async () => { throw new Error('the gateway must not be called without a key'); } } }
  ];
  for (const { name, jev } of cases) {
    const lines = [];
    await withServer(demoOptions({
      fetchImpl: nanoReturns(['sleep']),
      jev: primaryJev({ ...jev, log: line => lines.push(line) })
    }), async url => {
      const result = await (await post(url, 'how do I stop waking up exhausted')).json();
      assert.equal(result.mode, 'ai-topic-map', `${name}: the nano path still serves`);
      assert.ok(result.citations.every(citation => citation.guest === 'sleep'), `${name}: nano decides`);
      const [log] = await waitForLines(lines, 1);
      assert.equal(log.error, name, `${name}: the failure kind is recorded`);
      assert.equal(log.mode, 'primary');
      assert.equal(log.decided, 'nano');
      assert.deepEqual(log.nano, ['sleep']);
    });
  }
});

test('shadow mode is unchanged by the primary path and an unknown mode stays shadow', async () => {
  // Jev picks brain in both cases; the shadow must never reach the response.
  const shadowFetch = gatewayOk(choice('brain', { brain: 0.8, sleep: 0.15, [NONE_OPTION]: 0.05 }));
  for (const mode of ['shadow', undefined, 'PRIMARY-ish']) {
    const lines = [];
    await withServer(demoOptions({
      fetchImpl: nanoReturns(['sleep']),
      jev: { enabled: true, mode, apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: shadowFetch }
    }), async url => {
      const result = await (await post(url, 'how do I stop waking up exhausted')).json();
      assert.ok(result.citations.every(citation => citation.guest === 'sleep'), `mode ${mode}: nano decides in shadow mode`);
      const [log] = await waitForLines(lines, 1);
      assert.equal(log.mode, undefined, `mode ${mode}: the shadow log shape is untouched`);
      assert.equal(log.decided, undefined);
      // Shadow keeps its relative ranking: sleep stays above the abstain option.
      assert.deepEqual(log.jev, ['brain', 'sleep']);
    });
  }
});

test('JEV_ENABLED=false stays a no-op even with JEV_MODE=primary', async () => {
  let gatewayCalls = 0;
  const lines = [];
  let baseline;
  await withServer(demoOptions({ fetchImpl: nanoReturns(['sleep']) }), async url => {
    baseline = await (await post(url, 'how do I stop waking up exhausted')).json();
  });
  await withServer(demoOptions({
    fetchImpl: nanoReturns(['sleep']),
    jev: { enabled: false, mode: 'primary', apiKey: 'gateway-key', timeoutMs: 650, log: line => lines.push(line), fetchImpl: async () => { gatewayCalls++; return new Response('{}'); } }
  }), async url => {
    assert.deepEqual(await (await post(url, 'how do I stop waking up exhausted')).json(), baseline);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(gatewayCalls, 0);
    assert.equal(lines.length, 0);
  });
});

test('the default jev config is shadow mode and disabled when JEV_ENABLED is unset', async () => {
  assert.equal(process.env.JEV_MODE, undefined);
  assert.equal(process.env.JEV_ENABLED, undefined);
  let gatewayCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('ai-gateway.vercel.sh')) { gatewayCalls++; return new Response('{}'); }
    return originalFetch(url, options);
  };
  try {
    await withServer(demoOptions({ fetchImpl: nanoReturns(['sleep']) }), async url => {
      await (await post(url, 'how do I stop waking up exhausted')).json();
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(gatewayCalls, 0);
    });
  } finally { globalThis.fetch = originalFetch; }
});
