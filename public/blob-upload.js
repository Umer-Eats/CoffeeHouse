/* Vercel Blob client-direct upload — lightweight browser helper.
   Uploads files straight to Vercel Blob (bypasses the 4.5 MB serverless limit).
   Flow: POST /api/blob/upload → get client token → PUT to Blob API → get URL. */
'use strict';
(function () {
  var BLOB_API = 'https://vercel.com/api/blob';
  var API_VERSION = '12';

  async function uploadToBlob(file, opts) {
    opts = opts || {};
    var ext = (file.name || 'file').split('.').pop().toLowerCase();
    var prefix = opts.prefix || 'coffeehouse-uploads';
    var pathname = prefix + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    /* Step 1 — get a client token from our server */
    var tokenRes = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: { pathname: pathname, clientPayload: null, multipart: false }
      })
    });
    if (!tokenRes.ok) {
      var err = await tokenRes.json().catch(function () { return { error: 'Could not get upload token.' }; });
      throw new Error(err.error || 'Could not get upload token.');
    }
    var tokenData = await tokenRes.json();
    var clientToken = tokenData.clientToken;
    if (!clientToken) throw new Error('Server did not return a client token.');

    /* Step 2 — read file as ArrayBuffer, then PUT directly to Vercel Blob API */
    var arrayBuffer = await file.arrayBuffer();
    var bytes = new Uint8Array(arrayBuffer);
    var requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    var putUrl = BLOB_API + '/?pathname=' + encodeURIComponent(pathname);
    var putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + clientToken,
        'x-api-version': API_VERSION,
        'x-api-blob-request-id': requestId,
        'x-api-blob-request-attempt': '0'
      },
      body: bytes
    });
    if (!putRes.ok) {
      var body = await putRes.json().catch(function () { return { error: { message: 'Upload failed.' } }; });
      throw new Error((body.error && body.error.message) || 'Upload failed (' + putRes.status + ').');
    }
    var result = await putRes.json();
    return { url: result.url, pathname: result.pathname, contentType: result.contentType };
  }

  /* Upload a base64-encoded attachment directly — no intermediate File/Blob needed. */
  async function uploadBase64(attachment, opts) {
    var binary = atob(attachment.data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var ext = ((attachment.name || 'file').split('.').pop() || 'bin').toLowerCase();
    if (attachment.mimeType === 'image/jpeg') ext = 'jpg';
    else if (attachment.mimeType === 'image/png') ext = 'png';
    else if (attachment.mimeType === 'image/webp') ext = 'webp';
    else if (attachment.mimeType === 'application/pdf') ext = 'pdf';
    var prefix = (opts && opts.prefix) || 'coffeehouse-uploads';
    var pathname = prefix + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    var tokenRes = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: { pathname: pathname, clientPayload: null, multipart: false }
      })
    });
    if (!tokenRes.ok) {
      var err = await tokenRes.json().catch(function () { return { error: 'Could not get upload token.' }; });
      throw new Error(err.error || 'Could not get upload token.');
    }
    var tokenData = await tokenRes.json();
    var clientToken = tokenData.clientToken;
    if (!clientToken) throw new Error('Server did not return a client token.');

    var requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    var putUrl = BLOB_API + '/?pathname=' + encodeURIComponent(pathname);
    var putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + clientToken,
        'x-api-version': API_VERSION,
        'x-api-blob-request-id': requestId,
        'x-api-blob-request-attempt': '0'
      },
      body: bytes
    });
    if (!putRes.ok) {
      var body = await putRes.json().catch(function () { return { error: { message: 'Upload failed.' } }; });
      throw new Error((body.error && body.error.message) || 'Upload failed (' + putRes.status + ').');
    }
    var result = await putRes.json();
    return { url: result.url, pathname: result.pathname, contentType: result.contentType };
  }

  window.VercelBlob = { upload: uploadToBlob, uploadBase64: uploadBase64 };
})();
