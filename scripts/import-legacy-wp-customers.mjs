/**
 * Import CSV WooCommerce → tables legacy_wp_customers / legacy_wp_reservations.
 *
 * Usage:
 *   node scripts/import-legacy-wp-customers.mjs
 *
 * Prérequis: migration appliquée + SUPABASE_SERVICE_ROLE_KEY dans .env.local
 * CSV: scripts/data/legacy-wp/*.csv (gitignored)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = path.join(process.cwd(), 'scripts/data/legacy-wp');
const BATCH_SIZE = 100;

function readEnvFile() {
  try {
    return fs.readFileSync('.env.local', 'utf8');
  } catch {
    return '';
  }
}

function readEnvValue(envFile, key) {
  const match = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function csvNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') return null;
  return trimmed;
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Minimal CSV parser (RFC4180-ish, quoted fields, commas). */
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.replace(/^"|"$/g, '').trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((cells) => {
      const obj = {};
      for (let i = 0; i < headers.length; i += 1) {
        obj[headers[i]] = cells[i] ?? '';
      }
      return obj;
    });
}

function loadCsv(filename) {
  const full = path.join(DATA_DIR, filename);
  if (!fs.existsSync(full)) {
    throw new Error(`CSV manquant: ${full}`);
  }
  return parseCsv(fs.readFileSync(full, 'utf8'));
}

function toInt(value) {
  const cleaned = csvNull(value);
  if (cleaned == null) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function toIsoDateTime(value) {
  const cleaned = csvNull(value);
  if (!cleaned) return null;
  const normalized = cleaned.includes('T') ? cleaned : cleaned.replace(' ', 'T');
  const d = new Date(`${normalized}Z`);
  if (!Number.isFinite(d.getTime())) {
    const local = new Date(cleaned);
    return Number.isFinite(local.getTime()) ? local.toISOString() : null;
  }
  return d.toISOString();
}

/** Parse "du 06/08/23 au 20/08/23" → ISO dates YYYY-MM-DD */
function parseStayDatesFromTitle(title) {
  const match = title.match(/du\s+(\d{2})\/(\d{2})\/(\d{2})\s+au\s+(\d{2})\/(\d{2})\/(\d{2})/i);
  if (!match) return { start: null, end: null };
  const toIso = (dd, mm, yy) => {
    const year = 2000 + Number.parseInt(yy, 10);
    return `${year}-${mm}-${dd}`;
  };
  return {
    start: toIso(match[1], match[2], match[3]),
    end: toIso(match[4], match[5], match[6])
  };
}

function mapOrderStatus(status) {
  const code = csvNull(status) ?? 'wc-completed';
  if (code === 'wc-cancelled') return { status_code: 'CANCELLED', status_label: 'Annulée' };
  if (code === 'wc-on-hold') return { status_code: 'ON_HOLD', status_label: 'En attente' };
  if (code === 'wc-completed') return { status_code: 'COMPLETED', status_label: 'Terminée' };
  return { status_code: code.replace(/^wc-/, '').toUpperCase(), status_label: code };
}

function dateOnlyFromIso(iso) {
  if (!iso) return null;
  return iso.slice(0, 10);
}

async function upsertBatches(supabase, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`${table} upsert failed at offset ${i}: ${error.message}`);
    }
    console.log(`  ${table}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const envFile = readEnvFile();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || readEnvValue(envFile, 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || readEnvValue(envFile, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local).'
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('Lecture CSV…');
  const customersRaw = loadCsv('rcolo_wc_customer_lookup.csv');
  const addressesRaw = loadCsv('rcolo_wc_order_addresses.csv');
  const ordersRaw = loadCsv('rcolo_wc_orders.csv');
  const itemsRaw = loadCsv('rcolo_woocommerce_order_items.csv');
  const productLookupRaw = loadCsv('rcolo_wc_order_product_lookup.csv');
  console.log(
    `  customers=${customersRaw.length} addresses=${addressesRaw.length} orders=${ordersRaw.length} items=${itemsRaw.length} product_lookup=${productLookupRaw.length}`
  );

  const ordersById = new Map();
  for (const order of ordersRaw) {
    const id = toInt(order.id);
    if (id == null) continue;
    ordersById.set(id, order);
  }

  const billingByOrderId = new Map();
  for (const addr of addressesRaw) {
    if (csvNull(addr.address_type) !== 'billing') continue;
    const orderId = toInt(addr.order_id);
    if (orderId == null) continue;
    billingByOrderId.set(orderId, addr);
  }

  const ordersByWpUserId = new Map();
  const ordersByEmail = new Map();
  for (const order of ordersRaw) {
    const wpUserId = toInt(order.customer_id);
    if (wpUserId != null) {
      const list = ordersByWpUserId.get(wpUserId) ?? [];
      list.push(order);
      ordersByWpUserId.set(wpUserId, list);
    }
    const email = csvNull(order.billing_email)?.toLowerCase();
    if (email) {
      const list = ordersByEmail.get(email) ?? [];
      list.push(order);
      ordersByEmail.set(email, list);
    }
  }

  function pickLatestBilling(customer) {
    const email = csvNull(customer.email)?.toLowerCase();
    const wpUserId = toInt(customer.user_id);
    const candidates = new Map();
    for (const order of ordersByWpUserId.get(wpUserId) ?? []) {
      candidates.set(toInt(order.id), order);
    }
    if (email) {
      for (const order of ordersByEmail.get(email) ?? []) {
        candidates.set(toInt(order.id), order);
      }
    }
    const sorted = Array.from(candidates.values()).sort((a, b) => {
      const da = toIsoDateTime(a.date_created_gmt) ?? '';
      const db = toIsoDateTime(b.date_created_gmt) ?? '';
      return db.localeCompare(da);
    });
    for (const order of sorted) {
      const orderId = toInt(order.id);
      const billing = orderId != null ? billingByOrderId.get(orderId) : null;
      if (billing && csvNull(billing.address_1)) {
        return { order, billing };
      }
    }
    return { order: sorted[0] ?? null, billing: null };
  }

  const customerRows = [];
  let withoutAddress = 0;
  for (const customer of customersRaw) {
    const email = csvNull(customer.email)?.toLowerCase();
    if (!email) continue;
    const { billing } = pickLatestBilling(customer);
    if (!billing) withoutAddress += 1;
    customerRows.push({
      email,
      wp_customer_id: toInt(customer.customer_id),
      wp_user_id: toInt(customer.user_id),
      first_name: csvNull(billing?.first_name) ?? csvNull(customer.first_name) ?? '',
      last_name: csvNull(billing?.last_name) ?? csvNull(customer.last_name) ?? '',
      phone: csvNull(billing?.phone) ?? '',
      address_line1: csvNull(billing?.address_1) ?? '',
      address_line2: csvNull(billing?.address_2) ?? '',
      postal_code: csvNull(billing?.postcode) ?? csvNull(customer.postcode) ?? '',
      city: csvNull(billing?.city) ?? csvNull(customer.city) ?? '',
      country: csvNull(billing?.country) ?? csvNull(customer.country) ?? 'France',
      registered_at: toIsoDateTime(customer.date_registered),
      updated_at: new Date().toISOString()
    });
  }

  const customersByEmail = new Map();
  for (const row of customerRows) {
    customersByEmail.set(row.email, row);
  }
  /** @type {typeof customerRows} */
  const uniqueCustomers = Array.from(customersByEmail.values());

  const reservationRows = [];
  let skippedFees = 0;
  let skippedNoOrder = 0;
  let ordersWithoutLineItem = 0;
  const ordersWithLineItem = new Set();

  for (const item of itemsRaw) {
    const itemType = csvNull(item.order_item_type);
    if (itemType !== 'line_item') {
      skippedFees += 1;
      continue;
    }
    const orderId = toInt(item.order_id);
    const orderItemId = toInt(item.order_item_id);
    if (orderId == null || orderItemId == null) continue;
    const order = ordersById.get(orderId);
    if (!order) {
      skippedNoOrder += 1;
      continue;
    }
    ordersWithLineItem.add(orderId);

    const email =
      csvNull(order.billing_email)?.toLowerCase() ??
      csvNull(billingByOrderId.get(orderId)?.email)?.toLowerCase();
    if (!email) continue;

    const title = decodeHtmlEntities(csvNull(item.order_item_name) ?? 'Séjour réservé');
    const parsed = parseStayDatesFromTitle(title);
    const reservedAt = toIsoDateTime(order.date_created_gmt);
    const status = mapOrderStatus(order.status);

    reservationRows.push({
      email,
      wp_order_id: orderId,
      wp_order_item_id: orderItemId,
      stay_title: title,
      session_start_date: parsed.start ?? dateOnlyFromIso(reservedAt),
      session_end_date: parsed.end ?? dateOnlyFromIso(reservedAt),
      reserved_at: reservedAt,
      status_code: status.status_code,
      status_label: status.status_label,
      updated_at: new Date().toISOString()
    });
  }

  for (const orderId of ordersById.keys()) {
    if (!ordersWithLineItem.has(orderId)) ordersWithoutLineItem += 1;
  }

  const orphanEmails = new Set();
  for (const res of reservationRows) {
    if (!customersByEmail.has(res.email)) orphanEmails.add(res.email);
  }

  for (const email of orphanEmails) {
    const stub = {
      email,
      wp_customer_id: null,
      wp_user_id: null,
      first_name: '',
      last_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      postal_code: '',
      city: '',
      country: 'France',
      registered_at: null,
      updated_at: new Date().toISOString()
    };
    customersByEmail.set(email, stub);
    uniqueCustomers.push(stub);
  }

  console.log('Upsert customers…');
  await upsertBatches(supabase, 'legacy_wp_customers', uniqueCustomers, 'email');

  console.log('Upsert reservations…');
  await upsertBatches(supabase, 'legacy_wp_reservations', reservationRows, 'wp_order_item_id');

  console.log('\nRésumé import:');
  console.log(`  clients upsertés: ${uniqueCustomers.length}`);
  console.log(`  clients sans adresse billing: ${withoutAddress}`);
  console.log(`  réservations (line_items): ${reservationRows.length}`);
  console.log(`  fees ignorés: ${skippedFees}`);
  console.log(`  line_items sans commande: ${skippedNoOrder}`);
  console.log(`  commandes sans line_item: ${ordersWithoutLineItem}`);
  console.log(`  emails résa orphelins (hors customer_lookup): ${orphanEmails.size}`);
  if (orphanEmails.size > 0 && orphanEmails.size <= 20) {
    console.log(`    → ${Array.from(orphanEmails).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
