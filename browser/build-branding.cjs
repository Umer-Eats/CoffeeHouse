/* Derive browser icons from the same pixel cup used in every header. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public/images/coffeehouse-logo.svg'), 'utf8').replaceAll('currentColor', '#fff0cd');
// Cream art vanishes on white tabs, Google results, and dashboards, so icons sit on the header brown.
const tile = svg.replace(/viewBox="[^"]+"([^>]*)>/, 'viewBox="-4 -4 48 48"$1>\n  <rect x="-4" y="-4" width="48" height="48" rx="9" fill="#3d261a"/>');
for (const file of ['favicon.svg', 'public/favicon.svg']) fs.writeFileSync(path.join(root, file), tile);

// The source art uses only straight horizontal/vertical pixel edges.
function polygons(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  const shapes = [];
  let x = 0, y = 0, startX = 0, startY = 0, shape, command;
  while (tokens.length) {
    if (/^[a-z]$/i.test(tokens[0])) command = tokens.shift();
    const relative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case 'm':
        x = Number(tokens.shift()) + (relative ? x : 0);
        y = Number(tokens.shift()) + (relative ? y : 0);
        startX = x; startY = y; shape = [[x, y]]; shapes.push(shape); break;
      case 'h': x = Number(tokens.shift()) + (relative ? x : 0); shape.push([x, y]); break;
      case 'v': y = Number(tokens.shift()) + (relative ? y : 0); shape.push([x, y]); break;
      case 'z': x = startX; y = startY; command = null; break;
      default: throw Error('Unsupported pixel-art path command: ' + command);
    }
  }
  return shapes;
}
const layers = [...svg.matchAll(/<path fill="(#[0-9a-f]+)" d="([^"]+)"/g)].map(([, color, d]) => ({
  rgb: [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)), shapes: polygons(d)
}));
function inside(shapes, x, y) {
  let winding = 0;
  for (const shape of shapes) for (let i = 0; i < shape.length; i++) {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % shape.length];
    const side = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    if (ay <= y && by > y && side > 0) winding++;
    if (ay > y && by <= y && side < 0) winding--;
  }
  return winding !== 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
}
// Renders the cup on a 48-unit brown tile; `rounded` matches the SVG favicon, square suits iOS masks.
function png(size, rounded = true) {
  const pixels = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = y * (1 + size * 4) + 1 + x * 4;
    const u = (x + 0.5) * 48 / size - 4, v = (y + 0.5) * 48 / size - 4;
    const cx = Math.max(0, Math.abs(u - 20) - 15), cy = Math.max(0, Math.abs(v - 20) - 15);
    let color = rounded && cx * cx + cy * cy > 81 ? [0, 0, 0, 0] : [61, 38, 26, 255];
    for (const layer of layers) if (inside(layer.shapes, u, v)) color = [...layer.rgb, 255];
    pixels.set(color, offset);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const sizes = [16, 32, 48], images = sizes.map(size => png(size));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  directory[entry] = directory[entry + 1] = sizes[i];
  directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([directory, ...images]));
fs.writeFileSync(path.join(root, 'public/apple-touch-icon.png'), png(180, false));
// Google search favicons want a crawlable multiple of 48px; the manifest and logo schema want large PNGs.
for (const size of [48, 96, 192]) fs.writeFileSync(path.join(root, `public/favicon-${size}x${size}.png`), png(size));
fs.writeFileSync(path.join(root, 'public/icon-512.png'), png(512, false));
console.log('Built matching SVG, ICO, PNG, and Apple touch icons.');
