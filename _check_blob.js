const c = require('@vercel/blob/client');
console.log('client exports:', Object.keys(c).join(', '));
const s = require('@vercel/blob');
console.log('server exports:', Object.keys(s).join(', '));
