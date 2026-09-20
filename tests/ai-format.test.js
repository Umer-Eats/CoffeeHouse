'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {render} = require('../public/ai-format.js');
test('browser library assets referenced by pages exist locally', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['public/ai-assistant.html','public/student.html']) {
    const html = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    for (const match of html.matchAll(/(?:src|href)="\/vendor\/(katex|markdown-it)\/([^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(__dirname,'../node_modules',match[1],'dist',match[2])),match[0]);
    }
  }
});
test('formats headings, emphasis, lists and Riemann equations', () => {
  const html = render(String.raw`### The 4 Methods:

- **Left Sum ($L_n$):** Use the *left* edge.
  $$\text{Area} \approx \Delta x \cdot [f(x_0) + f(x_{n-1})]$$
- **Trapezoid:** $\frac{1 + 5}{2} = 3$
`);
  assert.match(html, /<h3>The 4 Methods:/);
  assert.match(html, /<strong>Left Sum/);
  assert.match(html, /<em>left<\/em>/);
  assert.match(html, /<ul>/);
  assert.match(html, /class="math-display"/);
  assert.match(html, /<math /);
  assert.match(html, /<mfrac>/);
});
test('supports bracket math and keeps literal code and currency intact', () => {
  assert.match(render(String.raw`\(x^2\) and \[\frac{a}{b}\]`), /<mfrac>/);
  assert.match(render('`$x$` costs $5 and $10.'), /<code>\$x\$<\/code> costs \$5 and \$10/);
});
test('does not execute HTML, unsafe links, or math commands', () => {
  const html = render(String.raw`<img src=x onerror=alert(1)>
[click](javascript:alert(1))
![tracker](https://example.test/track)
$\href{javascript:alert(1)}{click}$`);
  assert.doesNotMatch(html, /<img|<script|href="javascript:/);
  assert.match(html, /&lt;img/);
});
test('invalid math does not break the rest of the answer', () => {
  const html = render('**Answer** $\\frac{$ and more text.');
  assert.match(html, /could not be formatted/);
  assert.match(html, /and more text/);
});
