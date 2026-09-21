/* Vercel Blob upload — browser helper.
   Sends files as multipart/form-data to /api/blob/upload.
   The server uploads to Vercel Blob (no CORS issues) and returns the URL. */
'use strict';
(function () {
  async function uploadFile(file, opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'coffeehouse-uploads';
    var fd = new FormData();
    fd.append('file', file, file.name || 'file');
    fd.append('prefix', prefix);
    var res = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    });
    if (!res.ok) {
      var body = await res.json().catch(function () { return { error: 'Upload failed.' }; });
      throw new Error(body.error || 'Upload failed (' + res.status + ').');
    }
    return res.json();
  }

  async function uploadBase64(attachment, opts) {
    var binary = atob(attachment.data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var ext = ((attachment.name || 'file').split('.').pop() || 'bin').toLowerCase();
    if (attachment.mimeType === 'image/jpeg') ext = 'jpg';
    else if (attachment.mimeType === 'image/png') ext = 'png';
    else if (attachment.mimeType === 'image/webp') ext = 'webp';
    else if (attachment.mimeType === 'application/pdf') ext = 'pdf';
    var filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
    var file = new File([blob], filename, { type: attachment.mimeType });
    var prefix = (opts && opts.prefix) || (ext === 'pdf' ? 'coffeehouse-brewer' : 'coffeehouse-barista');
    return uploadFile(file, { prefix: prefix });
  }

  async function uploadFromDataUrl(dataUrl, mimeType, name, opts) {
    var parts = dataUrl.split(',');
    var base64 = parts[1] || parts[0];
    return uploadBase64({ data: base64, mimeType: mimeType, name: name || 'file' }, opts);
  }

  window.VercelBlob = { upload: uploadFile, uploadBase64: uploadBase64, uploadFromDataUrl: uploadFromDataUrl };
})();
