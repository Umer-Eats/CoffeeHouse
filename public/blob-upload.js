/* Vercel Blob upload — browser helper.
   Sends file as base64-encoded JSON to /api/blob/upload.
   The server uploads to Vercel Blob and returns the URL.
   Using JSON avoids Vercel's platform-level raw body size limits. */
'use strict';
(function () {
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var arr = new Uint8Array(reader.result);
        var binary = '';
        for (var i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
        resolve(btoa(binary));
      };
      reader.onerror = function () { reject(new Error('Failed to read file.')); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function uploadFile(file, opts) {
    opts = opts || {};
    var ext = (file.name || 'file').split('.').pop().toLowerCase();
    var base64 = await fileToBase64(file);
    var res = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: base64,
        name: file.name || 'file',
        type: file.type || 'application/octet-stream',
        ext: ext,
      }),
    });
    if (!res.ok) {
      var body = await res.json().catch(function () { return { error: 'Upload failed.' }; });
      throw new Error(body.error || 'Upload failed (' + res.status + ').');
    }
    return res.json();
  }

  async function uploadBase64(attachment, opts) {
    var ext = ((attachment.name || 'file').split('.').pop() || 'bin').toLowerCase();
    if (attachment.mimeType === 'image/jpeg') ext = 'jpg';
    else if (attachment.mimeType === 'image/png') ext = 'png';
    else if (attachment.mimeType === 'image/webp') ext = 'webp';
    else if (attachment.mimeType === 'application/pdf') ext = 'pdf';
    var filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var res = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: attachment.data,
        name: filename,
        type: attachment.mimeType || 'application/octet-stream',
        ext: ext,
      }),
    });
    if (!res.ok) {
      var body = await res.json().catch(function () { return { error: 'Upload failed.' }; });
      throw new Error(body.error || 'Upload failed (' + res.status + ').');
    }
    return res.json();
  }

  async function uploadFromDataUrl(dataUrl, mimeType, name, opts) {
    var parts = dataUrl.split(',');
    var base64 = parts[1] || parts[0];
    return uploadBase64({ data: base64, mimeType: mimeType, name: name || 'file' }, opts);
  }

  window.VercelBlob = { upload: uploadFile, uploadBase64: uploadBase64, uploadFromDataUrl: uploadFromDataUrl };
})();
