/* Vercel Blob helpers — download blob URLs to Gemini-compatible inline data, then clean up. */
'use strict';

const { del, getDownloadUrl } = require('@vercel/blob');
const { BlobError } = require('@vercel/blob');

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
      // Blob URL upload — fetch the file and convert to base64
      const resp = await fetch(img.url);
      if (!resp.ok) throw new Error('Failed to download attached file.');
      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const mimeType = img.mimeType || resp.headers.get('content-type') || 'application/octet-stream';
      resolved.push({ mimeType, data: buf.toString('base64') });
      // Track the blob URL for cleanup — extract the store key from the URL
      blobsToDelete.push(img.url);
    } else if (img.data) {
      // Inline base64 data (legacy path)
      resolved.push({ mimeType: img.mimeType, data: img.data });
    }
  }
  // Best-effort cleanup of uploaded blobs (don't block on failure)
  for (const url of blobsToDelete) {
    try { await del(url); } catch (_) { /* ignore cleanup errors */ }
  }
  return resolved;
}

module.exports = { resolveAttachments };
