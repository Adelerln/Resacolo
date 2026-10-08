/**
 * Génère les 4 guides d'utilisation PDF par profil (Admin, Organisateur, Partenaire, Commercial).
 *
 * Usage :
 *   npm run guides:pdf
 *   node scripts/generate-profile-guides.mjs [--out docs/guides] [--only admin,commercial]
 *
 * Nécessite Node >= 22.18 (exécution native des fichiers TypeScript « sans types »).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node signale que les fichiers .ts importés ne déclarent pas de "type" de module (sans impact ici).
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
  console.warn(warning);
});

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const outArg = readArg('out') ?? 'docs/guides';
const outDir = isAbsolute(outArg) ? outArg : resolve(rootDir, outArg);
const only = readArg('only')
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);

async function main() {
  const { renderProfileGuidePdf } = await import('../src/lib/guides/profile-user-guide-pdf.ts');
  const { PROFILE_GUIDES } = await import('../src/lib/guides/profile-user-guide-content.ts');

  const guides = only?.length ? PROFILE_GUIDES.filter((guide) => only.includes(guide.slug)) : PROFILE_GUIDES;
  if (guides.length === 0) {
    throw new Error(`Aucun guide à générer (--only ${only?.join(',')}). Profils : ${PROFILE_GUIDES.map((g) => g.slug).join(', ')}`);
  }

  await mkdir(outDir, { recursive: true });
  const date = new Date();

  for (const guide of guides) {
    const pdf = await renderProfileGuidePdf(guide, { rootDir, date });
    const target = join(outDir, guide.fileName);
    await writeFile(target, pdf);
    console.log(`✓ ${guide.profileName.padEnd(15)} ${(pdf.length / 1024).toFixed(0).padStart(5)} Ko  ${target}`);
  }
}

main().catch((error) => {
  console.error('Échec de la génération des guides :', error);
  process.exitCode = 1;
});
