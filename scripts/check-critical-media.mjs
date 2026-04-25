#!/usr/bin/env node

import { statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const KB = 1024;

const CRITICAL_ASSETS = [
  { path: 'public/image/contact/resacolo-contact-anim.webp', maxBytes: 600 * KB },
  { path: 'public/image/organisateurs/orga.webp', maxBytes: 650 * KB },
  { path: 'public/image/accueil/gif_accueil/chargement-animation-min.webp', maxBytes: 650 * KB },
  { path: 'public/image/accueil/gif_accueil/pictogrammes_Selection resacolo-min.webp', maxBytes: 650 * KB },
  { path: 'public/image/accueil/gif_accueil/pictogrammes_Inscription-min.webp', maxBytes: 650 * KB }
];

function formatKb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

let hasError = false;

for (const asset of CRITICAL_ASSETS) {
  const absolutePath = path.join(ROOT, asset.path);
  let size = 0;
  try {
    size = statSync(absolutePath).size;
  } catch {
    hasError = true;
    console.error(`ERROR asset manquant: ${asset.path}`);
    continue;
  }

  if (size > asset.maxBytes) {
    hasError = true;
    console.error(
      `ERROR poids critique dépassé: ${asset.path} (${formatKb(size)} > ${formatKb(asset.maxBytes)})`
    );
  } else {
    console.log(`OK ${asset.path}: ${formatKb(size)} / budget ${formatKb(asset.maxBytes)}`);
  }
}

if (hasError) {
  console.error('\nMedia budget check échoué.');
  process.exit(1);
}

console.log('\nMedia budget check OK.');
