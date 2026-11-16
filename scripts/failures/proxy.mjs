// Fault-injecting proxies for recording the failure corpus. The tests stay as they are; the app changes.
// One proxy sits in front of the ServeRest front (it rewrites the JS bundle: test ids, texts, the API URL),
// the other in front of the API (it delays, rewrites or fakes responses). Every rule counts its hits, so a
// fault that never fired is caught instead of being recorded as a failure it did not cause. Rules apply only
// while armed, so the setup and cleanup around the target test run against the real app.
import http from 'node:http';

const HOP_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding', 'host']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent != null) parent[last] = value;
}

function removePath(obj, dotted) {
  const keys = dotted.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent != null) delete parent[last];
}

/** set / rename / remove on a JSON body, with dotted paths ("produtos.0.preco"). */
function transform(json, change) {
  for (const [from, to] of Object.entries(change.rename ?? {})) {
    const value = getPath(json, from);
    removePath(json, from);
    setPath(json, to, value);
  }
  for (const [dotted, value] of Object.entries(change.set ?? {})) setPath(json, dotted, value);
  for (const dotted of change.remove ?? []) removePath(json, dotted);
  return json;
}

function matches(when, req, url) {
  if (when.method && when.method !== req.method) return false;
  if (when.path && !new RegExp(when.path).test(url.pathname + url.search)) return false;
  // Requests from the page carry an Origin header (cross-origin); the API client in the tests does not.
  if (when.from === 'browser' && !req.headers.origin) return false;
  if (when.from === 'test' && req.headers.origin) return false;
  return true;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

/**
 * API proxy. Rules: { when: { method, path, from }, then: { delayMs, abort, respond: { status, json, text },
 * status, json: { set, rename, remove }, stripQuery } }. The first matching rule applies.
 */
export async function startApiProxy(upstream, rules = []) {
  const hits = rules.map(() => 0);
  let armed = false;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, upstream);
      const body = await readBody(req);
      const index = !armed || req.method === 'OPTIONS' ? -1 : rules.findIndex((r) => matches(r.when ?? {}, req, url));
      const then = index >= 0 ? rules[index].then : {};
      if (index >= 0) hits[index] += 1;

      if (then.delayMs) await sleep(then.delayMs);
      if (then.abort) {
        req.socket.destroy();
        return;
      }
      const cors = req.headers.origin ? { 'access-control-allow-origin': '*' } : {};
      if (then.respond) {
        const { status = 200, json, text } = then.respond;
        if (json !== undefined) return send(res, status, { 'content-type': 'application/json; charset=utf-8', ...cors }, JSON.stringify(json));
        return send(res, status, { 'content-type': 'text/html; charset=utf-8', ...cors }, text ?? '');
      }

      const target = new URL(then.stripQuery ? url.pathname : url.pathname + url.search, upstream);
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !HOP_HEADERS.has(k)));
      const upstreamResponse = await fetch(target, {
        method: req.method,
        headers: { ...headers, 'accept-encoding': 'identity' },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });
      const outHeaders = Object.fromEntries([...upstreamResponse.headers].filter(([k]) => !HOP_HEADERS.has(k)));
      let payload = Buffer.from(await upstreamResponse.arrayBuffer());
      if (then.json) payload = Buffer.from(JSON.stringify(transform(JSON.parse(payload.toString('utf8')), then.json)));
      send(res, then.status ?? upstreamResponse.status, outHeaders, payload);
    } catch (error) {
      send(res, 599, { 'content-type': 'text/plain' }, `proxy error: ${error.message}`);
    }
  });
  const url = await listen(server);
  return { url, hits: () => [...hits], arm: (on) => (armed = on), close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Front proxy. Replacements: [{ find, replace }] on JS and HTML bodies; the API URL is always swapped. */
export async function startFrontProxy(upstream, apiUpstream, apiProxyUrl, replacements = []) {
  const hits = replacements.map(() => 0);
  let armed = false;
  const server = http.createServer(async (req, res) => {
    try {
      const target = new URL(req.url, upstream);
      const upstreamResponse = await fetch(target, { headers: { 'accept-encoding': 'identity' } });
      const headers = Object.fromEntries([...upstreamResponse.headers].filter(([k]) => !HOP_HEADERS.has(k)));
      const type = upstreamResponse.headers.get('content-type') ?? '';
      if (!/javascript|html/.test(type)) {
        return send(res, upstreamResponse.status, headers, Buffer.from(await upstreamResponse.arrayBuffer()));
      }
      let text = (await upstreamResponse.text()).split(apiUpstream).join(apiProxyUrl);
      if (armed) replacements.forEach(({ find, replace }, i) => {
        const parts = text.split(find);
        hits[i] += parts.length - 1;
        text = parts.join(replace);
      });
      // The bundle names are content hashes; caching across cases would mix faults.
      send(res, upstreamResponse.status, { ...headers, 'cache-control': 'no-store' }, text);
    } catch (error) {
      send(res, 599, { 'content-type': 'text/plain' }, `proxy error: ${error.message}`);
    }
  });
  const url = await listen(server);
  return { url, hits: () => [...hits], arm: (on) => (armed = on), close: () => new Promise((resolve) => server.close(resolve)) };
}
