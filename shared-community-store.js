'use strict';

// Community IDs select a table namespace inside the single account database.
// Rewrite SQL identifiers only: quoted text, parameters and comments stay intact.
function sharedCommunityStore(mainClient, id, schema, tables) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw Error('Invalid community ID.');
  const prefix = `community_${Number(id)}_`;
  const identifiers = new Set(tables);
  for (const match of schema.matchAll(/CREATE INDEX IF NOT EXISTS (\w+)/g)) identifiers.add(match[1]);
  const rewrite = sql => sql.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|\b[A-Za-z_]\w*\b/g, token => {
    const quoted = ['"', '`', '['].includes(token[0]);
    const name = quoted ? token.slice(1, -1) : token;
    return identifiers.has(name.toLowerCase()) ? prefix + name.toLowerCase() : token;
  });
  const statement = input => typeof input === 'string' ? rewrite(input) : {...input, sql: rewrite(input.sql)};
  return {
    execute: input => mainClient.execute(statement(input)),
    batch: (inputs, mode) => mainClient.batch(inputs.map(statement), mode),
    executeMultiple: sql => mainClient.executeMultiple(rewrite(sql)),
    initialize: () => mainClient.executeMultiple(rewrite(schema)),
    drop: () => mainClient.batch([...tables].reverse().map(table => `DROP TABLE IF EXISTS ${prefix}${table}`), 'write'),
    close() {} // The shared connection belongs to the application, not a community.
  };
}
module.exports = {sharedCommunityStore};
