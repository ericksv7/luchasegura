import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function openBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'ls-brave-'));
  const child = spawn(process.env.BROWSER_BIN || 'brave', [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe',
    '--user-data-dir=' + profile
  ], { stdio: ['ignore', 'ignore', process.env.LS_BROWSER_DEBUG ? 'inherit' : 'ignore', 'pipe', 'pipe'] });
  const pending = new Map();
  let buffer = '';
  let nextId = 0;
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', chunk => {
    buffer += chunk;
    const messages = buffer.split('\0');
    buffer = messages.pop();
    for (const raw of messages) {
      const message = JSON.parse(raw);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function fail(error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  child.on('error', fail);
  child.stdio[3].on('error', fail);
  child.stdio[4].on('error', fail);
  child.on('exit', code => fail(new Error('El navegador terminó con código ' + code)));
  function cdp(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }
  async function close() {
    if (child.pid && child.exitCode === null) {
      const finished = once(child, 'exit');
      child.kill();
      await finished;
    }
    await rm(profile, { force: true, recursive: true, maxRetries: 5, retryDelay: 150 });
  }
  try {
    const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    return { close, send: (method, params) => cdp(method, params, sessionId) };
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [, , html, pdf] = process.argv;
  const { send, close } = await openBrowser();
  try {
    const url = pathToFileURL(html).href;
    await send('Page.enable');
    await send('Page.navigate', { url });
    const result = await send('Runtime.evaluate', {
      expression: `(async () => {
        if (location.href !== ${JSON.stringify(url)}) throw new Error('No se pudo abrir la fuente maestra');
        if (document.readyState !== 'complete') await new Promise(resolve => addEventListener('load', resolve, {once:true}));
        await document.fonts.ready;
        return [...document.images].filter(image => !image.naturalWidth).map(image => image.src);
      })()`, awaitPromise: true, returnByValue: true
    });
    if (result.exceptionDetails || result.result.value.length) {
      throw new Error(JSON.stringify(result.exceptionDetails || result.result.value));
    }
    const { data } = await send('Page.printToPDF', {
      preferCSSPageSize: true, printBackground: true, generateDocumentOutline: true,
      generateTaggedPDF: true
    });
    await writeFile(pdf, Buffer.from(data, 'base64'));
  } finally {
    await close();
  }
}
