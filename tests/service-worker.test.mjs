import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, access } from "node:fs/promises";

async function worker() {
  const handlers = new Map();
  const buckets = new Map([["outro-aplicativo:v1", new Map()], ["nutrimara:/NutriMara/:old", new Map()]]);
  const caches = {
    async keys() { return [...buckets.keys()]; },
    async delete(key) { return buckets.delete(key); },
    async open(key) {
      if (!buckets.has(key)) buckets.set(key, new Map());
      const data = buckets.get(key);
      return {
        async addAll(urls) { for (const url of urls) { const file = new URL(url).pathname.slice('/NutriMara/'.length); const body = await readFile(new URL(`../docs/${file}`, import.meta.url)); data.set(url, body); } },
        async match(request) { const body = data.get(typeof request === 'string' ? request : request.url); return body ? new Response(body) : undefined; },
      };
    },
  };
  vm.runInNewContext(await readFile(new URL('../docs/sw.js',import.meta.url),'utf8'), {
    URL, caches, self: { registration: { scope: 'https://diw87.github.io/NutriMara/' }, clients: { async claim() {} }, addEventListener(name, handler) { handlers.set(name,handler); } },
    fetch: async () => { throw new Error('OFFLINE'); },
  });
  return { handlers, buckets };
}

test('compilação contém recursos instaláveis dentro da pasta do projeto', async () => {
  const manifest = JSON.parse(await readFile(new URL('../docs/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(new URL(manifest.start_url,'https://diw87.github.io/NutriMara/manifest.webmanifest').pathname,'/NutriMara/');
  assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons) await access(new URL(`../docs/${icon.src}`,import.meta.url));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
});

test('modo offline abre o aplicativo e atualização não apaga caches de outro projeto', async () => {
  const { handlers, buckets } = await worker();
  let completion;
  handlers.get('install')({ waitUntil(value) { completion=value; } }); await completion;
  handlers.get('activate')({ waitUntil(value) { completion=value; } }); await completion;
  assert.ok(buckets.has('outro-aplicativo:v1'));
  assert.ok(!buckets.has('nutrimara:/NutriMara/:old'));
  let response;
  handlers.get('fetch')({ request: { url:'https://diw87.github.io/NutriMara/',method:'GET',mode:'navigate' },respondWith(value) { response=value; } });
  assert.match(await (await response).text(),/<title>NutriMara/);
  let intercepted=false;
  handlers.get('fetch')({ request: { url:'https://diw87.github.io/outro/',method:'GET',mode:'navigate' },respondWith() { intercepted=true; } });
  assert.equal(intercepted,false);
});
