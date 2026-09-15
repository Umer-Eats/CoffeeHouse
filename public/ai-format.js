/* Shared safe Markdown + math rendering for new and saved AI responses. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('markdown-it'), require('katex'));
  else root.AIFormat = factory(root.markdownit, root.katex);
})(typeof window === 'undefined' ? this : window, function (MarkdownIt, katex) {
  'use strict';
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!MarkdownIt || !katex) return {render: text => '<p>' + escape(text) + '</p>'};
  const md = new MarkdownIt({html:false, breaks:true, linkify:false, typographer:false});
  // Never load arbitrary remote images or execute HTML supplied by an AI.
  md.disable('image');
  md.inline.ruler.before('escape', 'coffee_math', function (state, silent) {
    const start = state.pos, source = state.src;
    const open = ['$$', '\\[', '\\(', '$'].find(value => source.startsWith(value, start));
    if (!open) return false;
    const close = open === '\\[' ? '\\]' : open === '\\(' ? '\\)' : open;
    const begin = start + open.length;
    if (open === '$' && /\s/.test(source[begin] || ' ')) return false;
    let end = source.indexOf(close, begin);
    while (end !== -1) {
      let slashes = 0;
      for (let p = end - 1; p >= begin && source[p] === '\\'; p--) slashes++;
      if (slashes % 2 === 0 && !(open === '$' && (/\d/.test(source[end+1] || '') || /\s/.test(source[end-1] || ' ')))) break;
      end = source.indexOf(close, end + close.length);
    }
    if (end === -1 || end === begin) return false;
    if (!silent) {
      const token = state.push('coffee_math', '', 0);
      token.content = source.slice(begin, end);
      token.meta = {display:open === '$$' || open === '\\['};
    }
    state.pos = end + close.length;
    return true;
  });
  md.renderer.rules.coffee_math = function (tokens, index) {
    const token = tokens[index];
    try {
      return '<span class="' + (token.meta.display ? 'math-display' : 'math-inline') + '">' + katex.renderToString(token.content, {
        displayMode:token.meta.display, output:'htmlAndMathml', trust:false,
        throwOnError:true, strict:'ignore', maxExpand:500, maxSize:10, macros:{}
      }) + '</span>';
    } catch (_) {
      return '<span class="math-unavailable" title="' + escape(token.content) + '">[This equation could not be formatted. Ask for a plain-language explanation.]</span>';
    }
  };
  return {
    render(text) {
      // The mention routes the request; it need not prefix every displayed reply.
      return md.render(String(text || '').replace(/^@(?:baristi|brewer)\s*/i, ''));
    }
  };
});
