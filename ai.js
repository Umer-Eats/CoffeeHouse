/* CoffeeHouse AI service — real Google Gemini for BARISTI and
   NotebookLM (Gemini Notebook Enterprise) + Gemini for BREWER. */
'use strict';

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const hasKey = process.env.GEMINI_API_KEY && !String(process.env.GEMINI_API_KEY).startsWith('YOUR');
const genAI = hasKey
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const BARISTI_SYSTEM =
  'You are Baristi AI, the warm, pixel-coffee study barista inside CoffeeHouse. ' +
  'You help high school students explain any subject clearly, step by step, ' +
  'with friendly one-line summaries, memory aids and tiny examples. ' +
  'Keep answers concise (under 220 words), well-structured, and accurate. ' +
  'If asked to make a cheat sheet, produce a compact bulleted cheat sheet. ' +
  'Stay on-topic and never provide harmful content.';

const BREWER_SYSTEM =
  'You are Brewer AI, the NotebookLM-style study notes engine inside CoffeeHouse. ' +
  'Given a source (a channel feed or an uploaded document), distill it into a clean, ' +
  'structured study document. Return ONLY the document text in this exact shape:\n\n' +
  'STUDY DOCS — BREWED FROM: <source>\n' +
  '1. Key terms: one-line definitions.\n' +
  '2. Core concepts / formulas: the most important blocks.\n' +
  '3. Three likely quiz questions with one-line answers.\n' +
  '4. Open questions still unanswered in the source.\n' +
  'Keep it under 400 words, precise and skimmable.';

function model() {
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

async function generate(prompt, system = null) {
  if (!genAI) {
    throw Object.assign(new Error('Gemini API key is not configured on the server.'), { code: 'NO_KEY' });
  }
  const req = system
    ? { systemInstruction: system, contents: [{ role: 'user', parts: [{ text: prompt }] }] }
    : { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  const result = await model().generateContent(req);
  const text = result.response.text();
  if (!text) throw new Error('Gemini returned an empty response.');
  return text.trim();
}

/* ------------------------- BARISTI (Gemini) ------------------------- */

async function baristaReply(question) {
  const clean = String(question).replace(/^@baristi\b/i, '').trim() || 'Explain this topic simply.';
  return generate(clean, BARISTI_SYSTEM);
}

async function baristaCheatSheet(topic) {
  const clean = String(topic).replace(/^@baristi\b/i, '').trim() || 'General study tips';
  return generate(
    'Make a compact one-page cheat sheet for: ' + clean + '. Use tight bullet lists with key facts, mnemonics and one example each.',
    BARISTI_SYSTEM
  );
}

/* ------------------------- BREWER (NotebookLM + Gemini) ------------------------- */

const notebooklmEnabled = () => String(process.env.NOTEBOOKLM_ENABLED || '').toLowerCase() === 'true';

function notebooklmEndpoint(pathSeg) {
  const loc = process.env.NOTEBOOKLM_LOCATION || 'global';
  const project = process.env.NOTEBOOKLM_PROJECT || '';
  return `https://${loc}-discoveryengine.googleapis.com/v1alpha/projects/${project}/locations/${loc}/notebooks/${pathSeg}`;
}

async function notebooklmCreate(title) {
  const res = await fetch(notebooklmEndpoint(''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (process.env.NOTEBOOKLM_ACCESS_TOKEN || '')
    },
    body: JSON.stringify({ title })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('NotebookLM create failed: ' + res.status + ' ' + err.slice(0, 200));
  }
  return res.json();
}

async function notebooklmAddTextSource(notebookId, sourceName, content) {
  const res = await fetch(notebooklmEndpoint(notebookId + '/sources:batchCreate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (process.env.NOTEBOOKLM_ACCESS_TOKEN || '')
    },
    body: JSON.stringify({
      userContents: [{ textContent: { sourceName, content } }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('NotebookLM add source failed: ' + res.status + ' ' + err.slice(0, 200));
  }
  return res.json();
}

/**
 * Brew study notes from a source. Always analyzes with Gemini (the real,
 * working path). When NOTEBOOKLM_ENABLED=true, also creates a real
 * NotebookLM notebook and uploads the source so students can open it.
 */
async function brewNotes(source, text) {
  const body = String(text || '').trim();
  const label = String(source || 'unknown source').trim();
  if (!body) {
    throw new Error('No source text to brew. Paste content or pick a channel with messages.');
  }

  let notebook = null;
  if (notebooklmEnabled()) {
    try {
      const created = await notebooklmCreate('CoffeeHouse brew — ' + label + ' — ' + new Date().toISOString().slice(0, 16));
      const id = created.notebookId || (created.name && created.name.split('/').pop());
      if (id) {
        await notebooklmAddTextSource(id, label + '.txt', body);
        notebook = {
          id,
          link: `https://notebook.cloud.google.com/global/notebook/${id}?project=${process.env.NOTEBOOKLM_PROJECT || ''}`
        };
      }
    } catch (err) {
      console.error('NotebookLM (optional) failed, continuing with Gemini:', err.message);
      notebook = { error: err.message };
    }
  }

  const doc = await generate(
    'Source name: ' + label + '\n\nSource text:\n' + body.slice(0, 60000),
    BREWER_SYSTEM
  );

  return { doc, notebook, engine: notebooklmEnabled() ? 'notebooklm+gemini' : 'gemini' };
}

module.exports = { baristaReply, baristaCheatSheet, brewNotes, notebooklmEnabled, genAI };