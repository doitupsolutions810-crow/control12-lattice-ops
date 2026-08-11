export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Browser chat is intentionally read-only with respect to platform control.
 * Operator mutations must cross the separately authenticated CONTROL12
 * policy/admission surface; this route never forwards the platform bearer.
 */
export async function POST() {
  return Response.json(
    {
      error: 'cockpit mutations are not available through the chatbot',
      requiredBoundary: 'CONTROL12 policy and admission'
    },
    { status: 403, headers: { 'cache-control': 'no-store' } }
  );
}
