import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH =
  process.env.LETTER_TEMPLATE_FILE || path.join(__dirname, '..', 'templates', 'letter.html');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Reads templates/letter.html and substitutes {{token}} placeholders with escaped values.
export function renderLetterHtml(tokens) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => esc(tokens[key] ?? ''));
}
