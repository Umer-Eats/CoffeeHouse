/* Validate image payloads before forwarding them to the AI provider. */
'use strict';
const MAX_IMAGES = 2;
const MAX_BYTES = 1024 * 1024;
function invalid(message) { throw Object.assign(new Error(message), {status:400}); }
function jpegDimensions(bytes) {
  if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (length < 8) return null;
      return {height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
    }
    offset += length;
  }
  return null;
}
function validateImages(images) {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > MAX_IMAGES) invalid('Attach no more than two images.');
  return images.map(image => {
    if (!image) invalid('Please attach a JPEG, PNG, WebP, or PDF using the image picker.');
    if (image.mimeType === 'application/pdf') {
      if (typeof image.data !== 'string') invalid('PDF data is invalid. Please attach it again.');
      if (image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) invalid('The PDF data is invalid. Please attach it again.');
      const bytes = Buffer.from(image.data, 'base64');
      if (!bytes.length) invalid('PDF is empty. Please attach a valid PDF.');
      const maxPdfBytes = 200 * 1024 * 1024; // 200 MB decoded limit (accommodates base64 inflation)
      if (bytes.length > maxPdfBytes) invalid('PDF is too large. Please attach a smaller PDF (max 100 MB file).');
      return {mimeType:'application/pdf',data:image.data};
    }
    if (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/png' && image.mimeType !== 'image/webp') invalid('Please attach a JPEG, PNG, WebP, or PDF using the image picker.');
    if (image.data.length > Math.ceil(MAX_BYTES / 3) * 4) invalid('An image is too large. Please attach a smaller image.');
    if (image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) invalid('The image data is invalid. Please attach it again.');
    const bytes = Buffer.from(image.data, 'base64');
    const size = jpegDimensions(bytes);
    if (!size || !size.width || !size.height || size.width > 2000 || size.height > 2000 || bytes.length > MAX_BYTES) invalid('The image cannot be read. Please attach it again using the image picker.');
    return {mimeType:'image/jpeg',data:image.data};
  });
}
function inputText(value, limit, label) {
  if (value === undefined) return '';
  if (typeof value !== 'string') invalid(label + ' must be text.');
  if (value.length > limit) invalid(label + ' is too long.');
  return value.trim();
}
module.exports = {validateImages,inputText,jpegDimensions,MAX_IMAGES,MAX_BYTES};
