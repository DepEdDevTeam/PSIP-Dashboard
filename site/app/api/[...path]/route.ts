import type { NextRequest } from 'next/server';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_API_TIMEOUT_MS = 120_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const baseUrl = (process.env.PSIP_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
    /\/$/,
    '',
  );
  const target = new URL(`${baseUrl}/api/${path.map(encodeURIComponent).join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const configuredTimeout = Number(process.env.PSIP_API_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return Response.json(
      {
        detail: timedOut
          ? `The PSIP API did not finish within ${Math.round(timeoutMs / 1000)} seconds. Please retry.`
          : 'The local PSIP API is unavailable. Start FastAPI on 127.0.0.1:8000 and try again.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
