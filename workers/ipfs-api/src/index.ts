import { type Env, type UploadDocument, pinDocument, readDocument } from "./ipfs";

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  if (!origin || origin !== env.FRONTEND_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return origin === env.FRONTEND_ORIGIN
        ? new Response(null, { status: 204, headers })
        : json({ error: "Origin not permitted" }, 403);
    }

    if (origin && origin !== env.FRONTEND_ORIGIN) {
      return json({ error: "Origin not permitted" }, 403);
    }

    if (request.method === "POST" && url.pathname === "/upload") {
      const client = request.headers.get("CF-Connecting-IP") || "anonymous";
      const rateLimit = await env.UPLOAD_RATE_LIMITER.limit({ key: `upload:${client}` });
      if (!rateLimit.success) return json({ error: "Upload rate limit exceeded" }, 429, headers);

      try {
        const document = await request.json() as UploadDocument;
        return json(await pinDocument(document, env), 201, headers);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Upload failed" }, 400, headers);
      }
    }

    if (request.method === "GET" && url.pathname.length > 1) {
      try {
        const upstream = await readDocument(url.pathname.slice(1), env);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            ...headers
          }
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "IPFS read failed" }, 502, headers);
      }
    }

    return json({ error: "Not found" }, 404, headers);
  }
};
