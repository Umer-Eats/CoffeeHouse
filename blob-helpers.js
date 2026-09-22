/* Resolve bounded attachments without letting storage stalls block AI forever. */
'use strict';
const {validateImages} = require('./image-input');
const fail = message => Object.assign(new Error(message), {status:400});
async function resolveAttachments(images, {fetchImpl = fetch, timeout = 15000, deleteBlob = async url => {
  if (process.env.BLOB_READ_WRITE_TOKEN) await require('@vercel/blob').del(url, {abortSignal:AbortSignal.timeout(2000)});
}} = {}) {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > 3) throw fail('Attach up to two images and one PDF.');
  if (images.filter(x => x?.mimeType === 'application/pdf').length > 1 || images.filter(x => x?.mimeType !== 'application/pdf').length > 2) throw fail('Attach up to two images and one PDF.');
  return Promise.all(images.map(async img => {
    if (!img || typeof img !== 'object') throw fail('Invalid attachment. Please attach it again.');
    if (!img.url) return validateImages([img])[0];
    let url;
    try { url = new URL(img.url); } catch { throw fail('Invalid attachment URL.'); }
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) || url.username || url.password || url.port || !/^\/coffeehouse-(barista|brewer)\/[a-zA-Z0-9_.-]+$/.test(url.pathname)) throw fail('Invalid attachment URL.');
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error('Attachment download timed out. Please try again.'), {status:504}));
        controller.abort();
      }, timeout);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const resp = await fetchImpl(url.href, {signal:controller.signal, redirect:'error'});
        if (!resp.ok) throw Object.assign(new Error('Could not read the uploaded file. Attach it again.'), {status:502});
        const max = img.mimeType === 'application/pdf' ? 20 * 1024 * 1024 : 1024 * 1024;
        const chunks = [];
        let size = 0;
        for await (const chunk of resp.body) {
          size += chunk.length;
          if (size > max) { controller.abort(); throw fail('Attached file is too large.'); }
          chunks.push(chunk);
        }
        return validateImages([{mimeType:img.mimeType, data:Buffer.concat(chunks).toString('base64')}])[0];
      })()]);
    } finally {
      clearTimeout(timer);
      // Bound best-effort cleanup too; storage retries must not delay the answer.
      let cleanupTimer;
      await Promise.race([
        Promise.resolve().then(() => deleteBlob(url.href)).catch(() => {}),
        new Promise(resolve => { cleanupTimer = setTimeout(resolve, 2100); }),
      ]).finally(() => clearTimeout(cleanupTimer));
    }
  }));
}
module.exports = {resolveAttachments};
