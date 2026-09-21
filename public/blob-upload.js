/* Vercel Blob upload — browser helper.
   Sends file as raw binary POST to /api/blob/upload with metadata in headers.
   The server uploads to Vercel Blob and returns the URL. */
'use strict';
(function () {
  async function uploadFile(file, opts) {
    opts = opts || {};
    var ext = (file.name || 'file').split('.').pop().toLowerCase();
    var buf = await file.arrayBuffer();
    var res = await fetch('/api/blob/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': file.name || 'file',
        'X-File-Type': file.type || 'application/octet-stream',
        'X-File-Ext': ext,
      },
      body: new Uint8Array(buf),
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
    return uploadFile(file, opts);
  }

  async function uploadFromDataUrl(dataUrl, mimeType, name, opts) {
    var parts = dataUrl.split(',');
    var base64 = parts[1] || parts[0];
    return uploadBase64({ data: base64, mimeType: mimeType, name: name || 'file' }, opts);
  }

  window.VercelBlob = { upload: uploadFile, uploadBase64: uploadBase64, uploadFromDataUrl: uploadFromDataUrl };
})();
