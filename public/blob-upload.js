/* File bytes go directly to Vercel Blob; our server only authorizes the upload. */
'use strict';
(function () {
  var extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

  async function uploadFile(file, opts) {
    opts = opts || {};
    var type = file.type || (/\.pdf$/i.test(file.name || '') ? 'application/pdf' : '');
    var ext = extensions[type];
    if (!ext) throw new Error('File type not allowed. Use JPEG, PNG, WebP, GIF, or PDF.');
    var maxMB = ext === 'pdf' ? 20 : 10;
    if (!file.size || file.size > maxMB * 1024 * 1024) throw new Error('Choose a non-empty file up to ' + maxMB + ' MB.');
    var prefix = opts.prefix || (ext === 'pdf' ? 'coffeehouse-brewer' : 'coffeehouse-barista');
    var pathname = prefix + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
    var uploadPromise = window.CoffeeHouseBlobClient.upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
      contentType: type,
    });
    // Do not leave the Brewer/Barista busy state running if Blob or the
    // browser's network stack stops responding.
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(new Error('File upload timed out. Please try again.')); }, 120000);
    });
    return Promise.race([uploadPromise, timeout]).finally(function () { clearTimeout(timer); });
  }

  async function uploadBase64(attachment, opts) {
    var binary = atob(attachment.data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return uploadFile(new Blob([bytes], { type: attachment.mimeType }), opts);
  }

  async function uploadFromDataUrl(dataUrl, mimeType, name, opts) {
    var parts = dataUrl.split(',');
    return uploadBase64({ data: parts[1] || parts[0], mimeType: mimeType, name: name || 'file' }, opts);
  }

  window.VercelBlob = { upload: uploadFile, uploadBase64: uploadBase64, uploadFromDataUrl: uploadFromDataUrl };
})();
