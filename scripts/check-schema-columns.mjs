import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const requiredColumnsPath = path.resolve(process.cwd(), 'config/required-schema-columns.json');
const REQUIRED_COLUMNS = JSON.parse(fs.readFileSync(requiredColumnsPath, 'utf8'));

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

function envValue(key, fallback = null) {
  if (process.env[key]) return process.env[key];
  const fromFile = readEnvFromFile()[key];
  return fromFile ?? fallback;
}

function isMissingColumnMessage(message, column) {
  return String(message ?? '').includes(`Could not find the '${column}' column`);
}

async function main() {
  const supabaseUrl = envValue('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey =
    envValue('SUPABASE_SERVICE_ROLE_KEY') ?? envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const missing = [];
  const failed = [];

  for (const item of REQUIRED_COLUMNS) {
    const { error } = await supabase.from(item.table).select(item.column).limit(1);
    if (!error) {
      console.log(`OK [${item.feature}] ${item.table}.${item.column}`);
      continue;
    }
    if (isMissingColumnMessage(error.message, item.column)) {
      missing.push(item);
      console.log(`MISSING [${item.feature}] ${item.table}.${item.column}`);
      continue;
    }
    failed.push({ ...item, error: error.message });
    console.log(`ERROR [${item.feature}] ${item.table}.${item.column} -> ${error.message}`);
  }

  if (missing.length > 0 || failed.length > 0) {
    console.error('\nSchema verification failed.');
    if (missing.length > 0) {
      console.error('Missing columns:');
      for (const item of missing) {
        console.error(`- [${item.feature}] ${item.table}.${item.column}`);
      }
    }
    if (failed.length > 0) {
      console.error('Query failures:');
      for (const item of failed) {
        console.error(`- ${item.table}.${item.column}: ${item.error}`);
      }
    }
    process.exit(1);
  }

  console.log('\nAll required columns are available in schema cache.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
