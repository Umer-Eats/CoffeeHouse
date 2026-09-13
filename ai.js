/* CoffeeHouse AI service — Baristi and Brewer, each powered by Google Gemini. */
'use strict';

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

/* ---- Baristi client ---- */
const baristaKey = process.env.BARISTA_API_KEY;
const baristaGenAI = baristaKey && !String(baristaKey).startsWith('YOUR')
  ? new GoogleGenerativeAI(baristaKey) : null;
const BARISTA_MODEL = process.env.BARISTA_MODEL || 'gemini-3.6-flash';

/* ---- Brewer client ---- */
const brewerKey = process.env.BREWER_API_KEY;
const brewerGenAI = brewerKey && !String(brewerKey).startsWith('YOUR')
  ? new GoogleGenerativeAI(brewerKey) : null;
const BREWER_MODEL = process.env.BREWER_MODEL || 'gemini-3.6-flash';

/* ---- System prompts ---- */

const BARISTI_SYSTEM =
  'You are Baristi AI, the warm, pixel-coffee study barista inside CoffeeHouse. ' +
  'You help high school students explain any subject clearly, step by step, ' +
  'with friendly one-line summaries, memory aids and tiny examples. ' +
  'Keep answers concise (under 220 words), well-structured, and accurate. ' +
  'If asked to make a cheat sheet, produce a compact bulleted cheat sheet. ' +
  'Stay on-topic and never provide harmful content.';

const BREWER_SYSTEM =
  'You are Brewer AI, the study notes engine inside CoffeeHouse. ' +
  'Given a source (a channel feed or an uploaded document), distill it into a clean, ' +
  'structured study document. Return ONLY the document text in this exact shape:\n\n' +
  'STUDY DOCS — BREWED FROM: <source>\n' +
  '1. Key terms: one-line definitions.\n' +
  '2. Core concepts / formulas: the most important blocks.\n' +
  '3. Three likely quiz questions with one-line answers.\n' +
  '4. Open questions still unanswered in the source.\n' +
  'Keep it under 400 words, precise and skimmable.';

/* ---- Helpers ---- */

async function generate(genAI, model, prompt, system = null) {
  if (!genAI) {
    throw Object.assign(new Error('API key is not configured on the server.'), { code: 'NO_KEY' });
  }
  const req = system
    ? { systemInstruction: system, contents: [{ role: 'user', parts: [{ text: prompt }] }] }
    : { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  const result = await genAI.getGenerativeModel({ model }).generateContent(req);
  const text = result.response.text();
  if (!text) throw new Error('AI returned an empty response.');
  return text.trim();
}

/* ---- Baristi ---- */

async function baristaReply(question) {
  const clean = String(question).replace(/^@baristi\b/i, '').trim() || 'Explain this topic simply.';
  return generate(baristaGenAI, BARISTA_MODEL, clean, BARISTI_SYSTEM);
}

async function baristaCheatSheet(topic) {
  const clean = String(topic).replace(/^@baristi\b/i, '').trim() || 'General study tips';
  return generate(
    baristaGenAI, BARISTA_MODEL,
    'Make a compact one-page cheat sheet for: ' + clean + '. Use tight bullet lists with key facts, mnemonics and one example each.',
    BARISTI_SYSTEM
  );
}

/* ---- Brewer ---- */

const isConfigured = () => !!brewerGenAI;

async function brewNotes(source, text) {
  const body = String(text || '').trim();
  const label = String(source || 'unknown source').trim();
  if (!body) {
    throw new Error('No source text to brew. Paste content or pick a channel with messages.');
  }

  const doc = await generate(
    brewerGenAI, BREWER_MODEL,
    'Source name: ' + label + '\n\nSource text:\n' + body.slice(0, 60000),
    BREWER_SYSTEM
  );

  return { doc, engine: 'gemini' };
}

module.exports = { baristaReply, baristaCheatSheet, brewNotes, isConfigured };
