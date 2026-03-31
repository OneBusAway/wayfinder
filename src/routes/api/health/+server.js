import { PUBLIC_OBA_SERVER_URL } from '$env/static/public';

/** Simple health check for the server and OBA config */
export function GET() {
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    obaServer: PUBLIC_OBA_SERVER_URL || null
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
