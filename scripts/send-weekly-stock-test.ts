/**
 * Envoi test du rapport stocks hebdo pour un organisateur.
 *
 * Usage:
 *   node --import tsx scripts/send-weekly-stock-test.ts --organizer=thalie --to=monsejour@thalie.org
 *
 * Requiert dans .env.local : SUPABASE_*, SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildWeeklyStockReportSubject,
  buildWeeklyStockReports,
  getParisClock,
  renderWeeklyStockReportHtml,
  renderWeeklyStockReportText
} from '../src/lib/organizer-weekly-stock-report';
import { sendSmtpEmail } from '../src/lib/rag/smtp';
import type { Database } from '../src/types/supabase';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
}

async function main() {
  loadEnvLocal();

  const organizerFilter = (argValue('organizer') || 'thalie').toLowerCase();
  const to = (argValue('to') || 'monsejour@thalie.org').toLowerCase();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error('SUPABASE URL / SERVICE_ROLE_KEY manquants dans .env.local');
  }

  const smtpReady = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
  );
  const previewOnly = process.argv.includes('--preview-only') || !smtpReady;

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const reports = await buildWeeklyStockReports(supabase);
  const matched = reports.filter((report) => {
    const name = report.organizerName.toLowerCase();
    return name.includes(organizerFilter) || report.organizerId.toLowerCase() === organizerFilter;
  });

  if (matched.length === 0) {
    console.error(
      `Aucun rapport trouvé pour « ${organizerFilter} ». Organisateurs disponibles:`,
      reports.map((r) => r.organizerName).slice(0, 30)
    );
    process.exit(1);
  }

  const reportDateIso = getParisClock().dateIso;
  const subject = buildWeeklyStockReportSubject(reportDateIso);

  for (const report of matched) {
    const html = renderWeeklyStockReportHtml({ report, reportDateIso });
    const text = renderWeeklyStockReportText({ report, reportDateIso });
    const safeName = report.organizerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const htmlPath = resolve(process.cwd(), `tmp-${safeName}-stock-report.html`);
    const textPath = resolve(process.cwd(), `tmp-${safeName}-stock-report.txt`);
    writeFileSync(htmlPath, html, 'utf8');
    writeFileSync(textPath, text, 'utf8');
    console.log(
      `Rapport ${report.organizerName}: ${report.activeSessionCount} sessions, ${report.remainingPlaces} places → ${htmlPath}`
    );

    if (previewOnly) {
      console.log(
        smtpReady
          ? 'Mode --preview-only: aucun envoi.'
          : 'SMTP non configuré (.env.local). Aperçu généré, pas d’envoi.'
      );
      continue;
    }

    console.log(`Envoi → ${to}`);
    await sendSmtpEmail({ to, subject, text, html });
    console.log('OK');
  }

  if (!smtpReady) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
