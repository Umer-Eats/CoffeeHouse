import { put } from '@vercel/blob/client';

// The SDK's upload helper drops abortSignal during token retrieval and replaces
// our JSON errors with a generic token failure. Keep this stage cancellable.
async function upload(pathname, file, options) {
  const response = await fetch(options.handleUploadUrl, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    signal: options.abortSignal,
    body: JSON.stringify({type:'blob.generate-client-token', payload:{pathname, multipart:false}}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.clientToken) throw new Error(data.error || 'Upload authorization failed. Sign in and try again.');
  return put(pathname, file, {
    token: data.clientToken,
    access: options.access,
    contentType: options.contentType,
    abortSignal: options.abortSignal,
  });
}
window.CoffeeHouseBlobClient = { upload };
