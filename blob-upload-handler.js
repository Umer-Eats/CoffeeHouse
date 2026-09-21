'use strict';

const CONTENT_TYPES = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

// Only metadata reaches this endpoint. File bytes go directly to Blob.
function createBlobUploadHandler({ handleUpload, sessionUser }) {
  return async (req, res) => {
    try {
      const result = await handleUpload({
        request: req,
        body: req.body,
        onBeforeGenerateToken: async (pathname) => {
          const user = await sessionUser(req.cookies.ch_session);
          if (!user) throw Object.assign(new Error('Sign in required.'), { status: 401 });
          const match = /^coffeehouse-(?:brewer|barista)\/[a-zA-Z0-9_-]+\.(pdf|jpg|jpeg|png|webp|gif)$/.exec(pathname);
          if (!match) throw Object.assign(new Error('Invalid upload path or file type.'), { status: 400 });
          return {
            allowedContentTypes: [CONTENT_TYPES[match[1]]],
            maximumSizeInBytes: (match[1] === 'pdf' ? 20 : 10) * 1024 * 1024,
            addRandomSuffix: true,
            allowOverwrite: false,
            validUntil: Date.now() + 10 * 60 * 1000,
          };
        },
      });
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message || 'Upload authorization failed.' });
    }
  };
}

module.exports = { createBlobUploadHandler };
