export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "butler-web",
    version: "c270-final",
    timestamp: new Date().toISOString(),
  });
}
