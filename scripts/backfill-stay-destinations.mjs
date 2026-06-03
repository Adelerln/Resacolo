import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile() {
  try {
    return fs.readFileSync('.env.local', 'utf8');
  } catch {
    return '';
  }
}

function readEnvValue(envFile, key) {
  const match = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function cleanText(value) {
  const cleaned = String(value ?? '').trim();
  return cleaned || null;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFranceLike(value) {
  return normalizeText(value) === 'france';
}

function mapRegion(value) {
  const key = normalizeText(value);
  if (!key) return null;
  const aliases = new Map([
    ['hauts de france', 'Hauts-de-France'],
    ['grand est', 'Grand Est'],
    ['provence alpes cote d azur', "Provence-Alpes-Côte d'Azur"],
    ['paca', "Provence-Alpes-Côte d'Azur"],
    ['auvergne rhone alpes', 'Auvergne-Rhône-Alpes'],
    ['bourgogne franche comte', 'Bourgogne-Franche-Comté'],
    ['occitanie', 'Occitanie'],
    ['pays de la loire', 'Pays de la Loire'],
    ['bretagne', 'Bretagne'],
    ['normandie', 'Normandie'],
    ['corse', 'Corse'],
    ['nouvelle aquitaine', 'Nouvelle-Aquitaine'],
    ['aquitaine', 'Nouvelle-Aquitaine'],
    ['centre val de loire', 'Centre-Val de Loire'],
    ['ile de france', 'Île-de-France'],
    ['etranger', 'Étranger']
  ]);
  if (aliases.has(key)) return aliases.get(key);
  return null;
}

function extractCountryFromText(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const normalized = normalizeText(cleaned);
  const aliases = [
    ['ouzbekistan', 'Ouzbékistan'],
    ['japon', 'Japon'],
    ['indonesie', 'Indonésie'],
    ['tanzanie', 'Tanzanie'],
    ['etats unis', 'États-Unis'],
    ['usa', 'États-Unis'],
    ['uk', 'Royaume-Uni'],
    ['united kingdom', 'Royaume-Uni']
  ];
  for (const [key, label] of aliases) {
    if (normalized.includes(key)) return label;
  }
  const parts = cleaned
    .split(',')
    .map((part) => cleanText(part))
    .filter(Boolean);
  const last = parts.at(-1);
  if (last && !isFranceLike(last) && !/^\d{2,3}[a-z]?$/i.test(last)) return last;
  return null;
}

function resolveDestination(stay) {
  const structuredType = cleanText(stay.destination_type);
  const structuredRegion = cleanText(stay.destination_region);
  const structuredCountry = cleanText(stay.destination_country);
  const structuredCountries = Array.isArray(stay.destination_countries)
    ? stay.destination_countries.map((c) => cleanText(c)).filter(Boolean)
    : [];
  const regionText = cleanText(stay.region_text);
  const locationText = cleanText(stay.location_text);

  const region = mapRegion(structuredRegion) ?? mapRegion(regionText);
  const country = structuredCountry ?? extractCountryFromText(locationText);
  let destinationType = structuredType;
  if (!destinationType) {
    if (region && region !== 'Étranger') destinationType = 'fixed_france';
    else if ((country && !isFranceLike(country)) || structuredCountries.length > 0 || region === 'Étranger') destinationType = 'fixed_abroad';
  }

  return {
    destination_type: destinationType ?? null,
    destination_region: region && region !== 'Étranger' ? region : null,
    destination_country:
      destinationType === 'fixed_france' ? 'France' : country && !isFranceLike(country) ? country : null,
    destination_countries:
      destinationType === 'itinerant'
        ? structuredCountries.length > 0
          ? structuredCountries
          : country && !isFranceLike(country)
            ? [country]
            : null
        : structuredCountries.length > 0
          ? structuredCountries
          : null
  };
}

async function main() {
  const envFile = readEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || readEnvValue(envFile, 'NEXT_PUBLIC_SUPABASE_URL');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    readEnvValue(envFile, 'SUPABASE_SERVICE_ROLE_KEY') ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    readEnvValue(envFile, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !key) {
    throw new Error('Variables Supabase manquantes (URL/KEY).');
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('stays')
    .select(
      'id,title,status,destination_type,destination_region,destination_country,destination_countries,region_text,location_text'
    )
    .eq('status', 'PUBLISHED');
  if (error) throw error;

  let scanned = 0;
  let updated = 0;
  for (const stay of data ?? []) {
    scanned += 1;
    const resolved = resolveDestination(stay);
    const patch = {};

    if (!stay.destination_type && resolved.destination_type) patch.destination_type = resolved.destination_type;
    if (!stay.destination_region && resolved.destination_region) patch.destination_region = resolved.destination_region;
    if (!stay.destination_country && resolved.destination_country) patch.destination_country = resolved.destination_country;
    if ((!stay.destination_countries || stay.destination_countries.length === 0) && resolved.destination_countries) {
      patch.destination_countries = resolved.destination_countries;
    }

    if (Object.keys(patch).length === 0) continue;
    const { error: updateError } = await supabase.from('stays').update(patch).eq('id', stay.id);
    if (updateError) throw updateError;
    updated += 1;
    console.log('updated', stay.id, stay.title, patch);
  }

  console.log(`done: scanned=${scanned} updated=${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
