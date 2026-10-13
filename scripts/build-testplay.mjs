import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
async function asset(url) {
  if (!url.startsWith('/assets/') || url.includes('..')) throw new Error(`Unexpected asset: ${url}`);
  return readFile(path.join(dist, url.slice(1)), 'utf8');
}
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Expected one bundled script and stylesheet');
for (const match of scripts) {
  const js = await asset(match[1]);
  // This app has no external imports or split chunks; fail if the build starts requiring them.
  if (/\bimport\s*(?:\(|["'{*])/.test(js)) throw new Error('Standalone export does not support external module imports');
  html = html.replace(match[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of styles) {
  const css = await asset(match[1]);
  if (/@import|url\(/i.test(css)) throw new Error('Standalone export requires self-contained CSS');
  html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
await mkdir(path.join(root, 'testplay'), { recursive: true });
await writeFile(path.join(root, 'testplay/index.html'), html);
console.log('Created testplay/index.html — open directly in a browser');
