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

function readInt(name: string, fallback: number) {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getRagEnv(): RagEnv {
  const chatModel = read('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const embedModel = read('OPENAI_EMBED_MODEL') ?? 'text-embedding-3-small';
  const reindexToken = read('RAG_REINDEX_TOKEN');
  const escalationEmail = read('CHATBOT_ESCALATION_EMAIL');

  const smtpHost = read('SMTP_HOST');
  const smtpUser = read('SMTP_USER');
  const smtpPass = read('SMTP_PASS');
  const smtpFrom = read('SMTP_FROM');
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
