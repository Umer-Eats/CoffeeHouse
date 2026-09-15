'use strict';
async function withRetry(action, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); }
    catch (error) {
      if (attempt >= 2 || ![429,500,502,503,504].includes(Number(error.status))) throw error;
      await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }
}
module.exports = {withRetry};
