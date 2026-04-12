import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

const partnerContactSchema = z.object({
  institution: z.string().trim().min(2).max(180),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  formula: z.enum(['Formule Sérénité', 'Formule Identité']),
  message: z.string().trim().min(10).max(4000),
  turnstileToken: z.string().min(1)
});

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

async function verifyTurnstileTokenWithSecret(secret: string, token: string, remoteIp: string | null) {
  const normalizedSecret = secret.trim();

  const payload = new URLSearchParams();
  payload.set('secret', normalizedSecret);
  payload.set('response', token);
  if (remoteIp) {
    payload.set('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    cache: 'no-store'
  });

  if (!response.ok) {
    return { success: false, errorCodes: ['verification_unavailable'] };
  }

  const json = (await response.json()) as TurnstileVerifyResponse;
  return {
    success: Boolean(json.success),
    errorCodes: json['error-codes'] ?? []
  };
}

async function verifyTurnstileToken(token: string, remoteIp: string | null) {
  const secrets = new Set<string>();
  if (process.env.TURNSTILE_SECRET_KEY?.trim()) {
    secrets.add(process.env.TURNSTILE_SECRET_KEY.trim());
  }
  if (process.env.NODE_ENV !== 'production') {
    secrets.add(TURNSTILE_TEST_SECRET_KEY);
  }

  if (!secrets.size) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured');
  }

  let lastResult: { success: boolean; errorCodes: string[] } = {
    success: false,
    errorCodes: ['verification_unavailable']
  };

  const secretList = Array.from(secrets);
  for (let index = 0; index < secretList.length; index += 1) {
    const result = await verifyTurnstileTokenWithSecret(secretList[index], token, remoteIp);
    if (result.success) {
      return result;
    }
    lastResult = result;
  }

  return lastResult;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.headers.get('cf-connecting-ip');
}

export async function POST(request: Request) {
  try {
    const input = partnerContactSchema.parse(await request.json());

    const verification = await verifyTurnstileToken(input.turnstileToken, getClientIp(request));
    if (!verification.success) {
      return NextResponse.json(
        {
          error: 'Captcha invalide ou expiré. Merci de réessayer.',
          errorCodes: verification.errorCodes
        },
        { status: 400 }
      );
    }

    // TODO: brancher ici le transport réel (email / CRM / base de données).
    console.info('[partner-contact] message reçu', {
      institution: input.institution,
      name: input.name,
      email: input.email,
      formula: input.formula,
      messageLength: input.message.length,
      receivedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Formulaire invalide.',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    console.error('[partner-contact] erreur', error);
    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}
