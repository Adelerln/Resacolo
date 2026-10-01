import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractOrganizerPresentationHtmlForEditor,
  sanitizeOrganizerRichText,
  sanitizeOrganizerRichTextFromPaste
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

test('sanitizeOrganizerRichText preserves empty paragraphs for spacing', () => {
  const html = sanitizeOrganizerRichText('<p>Premier</p><p></p><p>Second</p>');
  assert.equal(html, '<p>Premier</p><p><br /></p><p>Second</p>');
});

test('sanitizeOrganizerRichTextFromPaste strips Word underline and keeps structure', () => {
  const html = sanitizeOrganizerRichTextFromPaste(
    '<p style="margin:0"><u><span style="color:red">Colos du Bonheur</span></u></p><p><u></u></p><p><u>Un séjour fun</u></p>',
    'Colos du Bonheur\n\nUn séjour fun'
  );
  assert.equal(html, '<p>Colos du Bonheur</p><p><br /></p><p>Un séjour fun</p>');
});

test('sanitizeOrganizerRichTextFromPaste keeps bold italic and lists', () => {
  const html = sanitizeOrganizerRichTextFromPaste(
    '<p><b>Titre</b> et <i>détail</i></p><ul><li>Point A</li><li>Point B</li></ul>',
    null
  );
  assert.equal(html, '<p><b>Titre</b> et <i>détail</i></p><ul><li>Point A</li><li>Point B</li></ul>');
});

test('sanitizeOrganizerRichTextFromPaste keeps paragraph breaks from plain text', () => {
  const html = sanitizeOrganizerRichTextFromPaste(null, 'Ligne 1\n\n\nLigne 2');
  assert.equal(html, '<p>Ligne 1</p><p><br /></p><p>Ligne 2</p>');
});
