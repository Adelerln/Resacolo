export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export type RagEnv = {
  chatModel: string;
  embedModel: string;
  reindexToken?: string;
  escalationEmail?: string;
  smtp?: SmtpConfig;
};

function read(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readFirst(...names: string[]) {
  for (const name of names) {
    const value = read(name);
    if (value) return value;
  }
  return undefined;
}

function readInt(name: string, fallback: number) {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Diagnostique sans exposer de secrets : quelles clés SMTP manquent. */
export function getMissingSmtpEnvKeys() {
  const missing: string[] = [];
  if (!readFirst('SMTP_HOST', 'SMTP_HOSTNAME')) missing.push('SMTP_HOST');
  if (!readFirst('SMTP_USER', 'SMTP_USERNAME')) missing.push('SMTP_USER');
  if (!readFirst('SMTP_PASS', 'SMTP_PASSWORD', 'SMTP_PASSWD')) missing.push('SMTP_PASS');
  if (!readFirst('SMTP_FROM', 'SMTP_FROM_EMAIL', 'SMTP_SENDER')) missing.push('SMTP_FROM');
  return missing;
}

export function getRagEnv(): RagEnv {
  const chatModel = read('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const embedModel = read('OPENAI_EMBED_MODEL') ?? 'text-embedding-3-small';
  const reindexToken = read('RAG_REINDEX_TOKEN');
  const escalationEmail = read('CHATBOT_ESCALATION_EMAIL');

  const smtpHost = readFirst('SMTP_HOST', 'SMTP_HOSTNAME');
  const smtpUser = readFirst('SMTP_USER', 'SMTP_USERNAME');
  const smtpPass = readFirst('SMTP_PASS', 'SMTP_PASSWORD', 'SMTP_PASSWD');
  const smtpFrom = readFirst('SMTP_FROM', 'SMTP_FROM_EMAIL', 'SMTP_SENDER');
  const smtpPort = readInt('SMTP_PORT', 465);

  const smtp =
    smtpHost && smtpUser && smtpPass && smtpFrom
      ? {
          host: smtpHost,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          port: smtpPort
        }
      : undefined;

  return {
    chatModel,
    embedModel,
    reindexToken,
    escalationEmail,
    smtp
  };
}

export function isPublicChatbotEnabled() {
  return process.env.NEXT_PUBLIC_CHATBOT_ENABLED === '1';
}
