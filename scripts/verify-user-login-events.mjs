import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnvFromFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf8');
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      if (index <= 0) return null;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      return [key, value];
    })
    .filter(Boolean);
  return Object.fromEntries(entries);
}

function envValue(key) {
  if (process.env[key]) return process.env[key];
  return readEnvFromFile()[key] ?? null;
}

async function main() {
  const supabaseUrl = envValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Configuration manquante : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const probe = await supabase.from('user_login_events').select('id').limit(1);
  if (probe.error) {
    console.error(`Table user_login_events inaccessible : ${probe.error.message}`);
    console.error('Appliquez supabase/migrations/20260630_create_user_login_events.sql dans Supabase.');
    process.exit(1);
  }
  console.log('OK table user_login_events');

  const insert = await supabase
    .from('user_login_events')
    .insert({
      email: 'schema-probe@resacolo.test',
      outcome: 'failure',
      error_code: 'schema-probe',
      app_role: 'UNKNOWN',
      source: 'app',
      metadata: { probe: true }
    })
    .select('id')
    .single();

  if (insert.error) {
    console.error(`Insert probe échoué : ${insert.error.message}`);
    process.exit(1);
  }
  console.log('OK insert probe');

  const cleanup = await supabase.from('user_login_events').delete().eq('id', insert.data.id);
  if (cleanup.error) {
    console.error(`Cleanup probe échoué : ${cleanup.error.message}`);
    process.exit(1);
  }
  console.log('OK cleanup probe');
  console.log('user_login_events est opérationnel.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
