/**
 * Génère le rapport stocks THALIE et l'envoie via Microsoft Outlook (macOS).
 * Usage: npx tsx scripts/send-thalie-stock-via-outlook.ts
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildWeeklyStockReportSubject,
  buildWeeklyStockReports,
  getParisClock,
  getStockAvailability,
  renderWeeklyStockReportHtml,
  renderWeeklyStockReportText,
  type WeeklyStockOrganizerReport
} from '../src/lib/organizer-weekly-stock-report';
import type { Database } from '../src/types/supabase';

const THALIE_ID = '4c0e4dc8-0e75-43dc-b414-d5c0a2d017f4';
const TO = 'monsejour@thalie.org';
const FROM_ACCOUNT = 'Mon Séjour - Thalie';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

function appleScriptString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function demoReport(): WeeklyStockOrganizerReport {
  const sessions = [
    {
      sessionId: 'demo-1',
      stayTitle: 'Aventure mer — Cap d’Agde (démo)',
      startDate: '2026-07-05',
      endDate: '2026-07-12',
      ageMin: 8,
      ageMax: 12,
      reserved: 12,
      remaining: 18,
      availability: getStockAvailability(18)
    },
    {
      sessionId: 'demo-2',
      stayTitle: 'Multi-activités montagne (démo)',
      startDate: '2026-07-19',
      endDate: '2026-07-26',
      ageMin: 10,
      ageMax: 14,
      reserved: 28,
      remaining: 2,
      availability: getStockAvailability(2)
    },
    {
      sessionId: 'demo-3',
      stayTitle: 'Colo nature & chevaux (démo)',
      startDate: '2026-08-02',
      endDate: '2026-08-09',
      ageMin: 7,
      ageMax: 11,
      reserved: 30,
      remaining: 0,
      availability: getStockAvailability(0)
    }
  ] as const;

  return {
    organizerId: THALIE_ID,
    organizerName: 'Thalie',
    contactEmail: TO,
    activeSessionCount: sessions.length,
    remainingPlaces: sessions.reduce((sum, s) => sum + s.remaining, 0),
    fullSessionCount: sessions.filter((s) => s.availability === 'full').length,
    seasons: [
      {
        seasonId: null,
        seasonName: 'Été',
        sessions: [...sessions],
        sessionCount: sessions.length,
        remainingPlaces: sessions.reduce((sum, s) => sum + s.remaining, 0)
      }
    ]
  };
}

function sendViaOutlook(input: { subject: string; htmlPath: string; text: string; to: string }) {
  // Outlook for Mac: HTML via opening file in browser-ish is flaky;
  // we set content from shell-escaped HTML file using do shell script + UTF-8.
  const script = `
set htmlPath to "${appleScriptString(input.htmlPath)}"
set htmlContent to do shell script "python3 -c 'import pathlib,sys; sys.stdout.write(pathlib.Path(sys.argv[1]).read_text(encoding=\\"utf-8\\"))' " & quoted form of htmlPath

tell application "Microsoft Outlook"
  activate
  set targetAccount to missing value
  repeat with a in exchange accounts
    if (name of a as text) is "${appleScriptString(FROM_ACCOUNT)}" then
      set targetAccount to a
      exit repeat
    end if
  end repeat

  set newMessage to make new outgoing message with properties {subject:"${appleScriptString(input.subject)}"}
  if targetAccount is not missing value then
    set account of newMessage to targetAccount
  end if

  -- Prefer HTML body when supported
  try
    set content of newMessage to htmlContent
  on error
    set content of newMessage to "${appleScriptString(input.text).slice(0, 2000)}"
  end try

  make new recipient at newMessage with properties {email address:{address:"${appleScriptString(input.to)}"}}
  send newMessage
end tell
`;

  const result = execFileSync('osascript', ['-e', script], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
  return result;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error('Supabase env manquant');

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const reports = await buildWeeklyStockReports(supabase);
  let report =
    reports.find((r) => r.organizerId === THALIE_ID) ||
    reports.find((r) => r.organizerName.toLowerCase().includes('thalie'));

  let usedDemo = false;
  if (!report || report.activeSessionCount === 0) {
    // Base liée au .env.local : Thalie n'a pas de séjours PUBLISHED → e-mail test avec données démo.
    report = demoReport();
    usedDemo = true;
  }

  const reportDateIso = getParisClock().dateIso;
  let html = renderWeeklyStockReportHtml({ report, reportDateIso });
  if (usedDemo) {
    html = html.replace(
      'État de vos séjours en stock',
      'État de vos séjours en stock (e-mail test)'
    );
    html = html.replace(
      'Voici le récapitulatif de vos places restantes sur Resacolo,<br />',
      'Ceci est un <strong>envoi test</strong> (aucun séjour publié trouvé dans cet environnement).<br />Voici un aperçu du format du récapitulatif stocks,<br />'
    );
  }
  const text = [
    usedDemo ? '[E-MAIL TEST — données démo, aucun séjour publié en base locale]' : '',
    renderWeeklyStockReportText({ report, reportDateIso })
  ]
    .filter(Boolean)
    .join('\n\n');
  const subject = `[TEST] ${buildWeeklyStockReportSubject(reportDateIso)} — Thalie`;

  const outHtml = resolve(process.cwd(), 'tmp-thalie-stock-report.html');
  writeFileSync(outHtml, html, 'utf8');
  console.log(
    JSON.stringify(
      {
        to: TO,
        fromAccount: FROM_ACCOUNT,
        subject,
        usedDemo,
        sessions: report.activeSessionCount,
        remaining: report.remainingPlaces,
        preview: outHtml
      },
      null,
      2
    )
  );

  sendViaOutlook({ subject, htmlPath: outHtml, text, to: TO });
  console.log('SENT_OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
