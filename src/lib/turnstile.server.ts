const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export type TurnstileVerificationResult = {
  success: boolean;
  errorCodes: string[];
};

async function verifyTurnstileTokenWithSecret(secret: string, token: string, remoteIp: string | null) {
  const payload = new URLSearchParams();
  payload.set('secret', secret.trim());
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

export function isTurnstilePreviewOrDevContext(request?: Request) {
  const vercelEnv = (process.env.VERCEL_ENV ?? '').trim().toLowerCase();
  if (process.env.NODE_ENV !== 'production' || vercelEnv === 'preview' || vercelEnv === 'development') {
    return true;
  }

  const host =
    request?.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase() ??
    request?.headers.get('host')?.split(':')[0]?.trim().toLowerCase() ??
    '';
  return host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
}

export async function verifyTurnstileToken(token: string, remoteIp: string | null, request?: Request) {
  const secrets: string[] = [];
  const envSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const devSecret = process.env.TURNSTILE_SECRET_KEY_DEV?.trim();
  const isPreviewOrDev = isTurnstilePreviewOrDevContext(request);

  if (envSecret) {
    secrets.push(envSecret);
  }
  if (isPreviewOrDev && devSecret && !secrets.includes(devSecret)) {
    secrets.push(devSecret);
  }
  if (isPreviewOrDev && !secrets.includes(TURNSTILE_TEST_SECRET_KEY)) {
    secrets.push(TURNSTILE_TEST_SECRET_KEY);
  }

  if (!secrets.length) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured');
  }

  let lastResult: TurnstileVerificationResult = {
    success: false,
    errorCodes: ['verification_unavailable']
  };

  for (const secret of secrets) {
    const result = await verifyTurnstileTokenWithSecret(secret, token, remoteIp);
    if (result.success) {
      return result;
    }
    lastResult = result;
  }

  return lastResult;
}

export function formatTurnstileUserError(errorCodes: string[]) {
  if (errorCodes.includes('invalid-input-secret')) {
    return 'Configuration captcha incorrecte côté serveur. Vérifiez que TURNSTILE_SECRET_KEY correspond à NEXT_PUBLIC_TURNSTILE_SITE_KEY sur Vercel.';
  }
  if (errorCodes.includes('invalid-input-response')) {
    return 'Captcha refusé : ajoutez le domaine de ce site (ex. votre-url.vercel.app) dans Cloudflare Turnstile > Hostname Management, puis redéployez.';
  }
  if (errorCodes.includes('timeout-or-duplicate')) {
    return 'Captcha expiré ou déjà utilisé. Rechargez la page et réessayez.';
  }
  if (errorCodes.includes('verification_unavailable')) {
    return 'Service captcha momentanément indisponible. Réessayez dans quelques instants.';
  }
  return 'Captcha invalide ou expiré. Merci de réessayer.';
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.headers.get('cf-connecting-ip');
}
