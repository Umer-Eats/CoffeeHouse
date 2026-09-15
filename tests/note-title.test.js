const test=require('node:test');
const assert=require('node:assert/strict');
const {noteTitle}=require('../note-title');
test('subject headings replace generic sources and labels',()=>{
  assert.equal(noteTitle('# Photosynthesis and Cellular Energy\nNotes','Brew — Pasted text'),'Photosynthesis and Cellular Energy');
  assert.equal(noteTitle('Useful facts','Make a cheat sheet about Riemann sums'),'Riemann sums');
  assert.equal(noteTitle('STUDY DOCS — BREWED FROM: pasted text\n1. Key terms:\nMitosis: cell division','Brew — Pasted text'),'Mitosis: cell division');
  assert.ok(noteTitle('# '+ 'Long '.repeat(100)).length<=90);
});
