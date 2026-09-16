/**
 * Envoi test du rapport stocks (vide ou réel) uniquement à monsejour@thalie.org via Outlook.
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

function emptyThalieReport(): WeeklyStockOrganizerReport {
  return {
    organizerId: THALIE_ID,
    organizerName: 'Thalie',
    contactEmail: TO,
    activeSessionCount: 0,
    remainingPlaces: 0,
    fullSessionCount: 0,
    seasons: []
  };
}

function sendViaOutlook(input: { subject: string; htmlPath: string; text: string; to: string }) {
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

  try
    set content of newMessage to htmlContent
  on error
    set content of newMessage to "${appleScriptString(input.text).slice(0, 2000)}"
  end try

  make new recipient at newMessage with properties {email address:{address:"${appleScriptString(input.to)}"}}
  send newMessage
end tell
`;

  return execFileSync('osascript', ['-e', script], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
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
  const report =
    reports.find((r) => r.organizerId === THALIE_ID) ||
    reports.find((r) => r.organizerName.toLowerCase().includes('thalie')) ||
    emptyThalieReport();

  const reportDateIso = getParisClock().dateIso;
  const html = renderWeeklyStockReportHtml({ report, reportDateIso });
  const text = renderWeeklyStockReportText({ report, reportDateIso });
  const subject = `[TEST] ${buildWeeklyStockReportSubject(reportDateIso)} — Thalie`;

  const outHtml = resolve(process.cwd(), 'tmp-thalie-stock-report.html');
  writeFileSync(outHtml, html, 'utf8');
  console.log(
    JSON.stringify(
      {
        to: TO,
        fromAccount: FROM_ACCOUNT,
        subject,
        sessions: report.activeSessionCount,
        remaining: report.remainingPlaces,
        emptyStock: report.activeSessionCount === 0,
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
