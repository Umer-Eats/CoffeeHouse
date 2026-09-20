/* Vercel Blob helpers — download blob URLs to Gemini-compatible inline data, then clean up. */
'use strict';

/**
 * Resolve an array of image objects that may contain either inline base64 data
 * or blob URLs.  Returns an array of {mimeType, data} objects ready for Gemini.
 * Deletes any Vercel Blob entries after reading.
 */
async function resolveAttachments(images) {
  if (!images || !images.length) return [];
  const resolved = [];
  const blobsToDelete = [];
  for (const img of images) {
    if (img.url) {
      const resp = await fetch(img.url);
      if (!resp.ok) throw new Error('Failed to download attached file.');
      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const mimeType = img.mimeType || resp.headers.get('content-type') || 'application/octet-stream';
      resolved.push({ mimeType, data: buf.toString('base64') });
      blobsToDelete.push(img.url);
    } else if (img.data) {
      resolved.push({ mimeType: img.mimeType, data: img.data });
    }
  }
  // Best-effort cleanup — only if the token is available
  if (blobsToDelete.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = require('@vercel/blob');
      for (const url of blobsToDelete) {
        try { await del(url); } catch (_) { /* ignore cleanup errors */ }
      }
    } catch (_) { /* @vercel/blob not available or token invalid */ }
  }
  return resolved;
}

module.exports = { resolveAttachments };
