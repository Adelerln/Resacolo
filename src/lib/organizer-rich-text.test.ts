import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractOrganizerPresentationHtmlForEditor,
  sanitizeOrganizerRichText
} from '@/lib/organizer-rich-text';

test('extractOrganizerPresentationHtmlForEditor strips internal metadata comments', () => {
  const html = extractOrganizerPresentationHtmlForEditor(
    '<p>Voyages responsables</p>\n<!-- resacolo:duration:5:10 -->\n<!-- resacolo:payment-aids:ancv_paper -->'
  );
  assert.equal(html, '<p>Voyages responsables</p>');
});

test('sanitizeOrganizerRichText keeps plain contenteditable output', () => {
  const html = sanitizeOrganizerRichText('<div>Colonies de vacances en France</div>');
  assert.match(html, /Colonies de vacances en France/);
});
