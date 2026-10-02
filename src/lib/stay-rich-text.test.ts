import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeStayRichText,
  sanitizeStayRichTextFromPaste,
  stripStayRichTextToPlain
} from '@/lib/stay-rich-text';

test('sanitizeStayRichText keeps bold and lists', () => {
  const html = sanitizeStayRichText('<p><strong>Titre</strong></p><ul><li>Point A</li></ul>');
  assert.equal(html, '<p><strong>Titre</strong></p><ul><li>Point A</li></ul>');
});

test('sanitizeStayRichText strips italic and underline', () => {
  const html = sanitizeStayRichText('<p><em>italique</em> et <u>souligné</u> et <i>i</i></p>');
  assert.equal(html, '<p>italique et souligné et i</p>');
});

test('sanitizeStayRichTextFromPaste strips unsafe tags', () => {
  const html = sanitizeStayRichTextFromPaste(
    '<p onclick="alert(1)"><b>OK</b><script>evil()</script></p>',
    null
  );
  assert.equal(html, '<p><b>OK</b></p>');
});

test('stripStayRichTextToPlain removes markup', () => {
  const plain = stripStayRichTextToPlain('<p><strong>Bonjour</strong></p><ul><li>A</li></ul>');
  assert.match(plain, /Bonjour/);
  assert.match(plain, /- A/);
  assert.doesNotMatch(plain, /</);
});
