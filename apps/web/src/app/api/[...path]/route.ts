import { NextRequest } from "next/server";
import { resolveBackendApiUrl } from "@/lib/backend-api";
import { appendSetCookieHeaders } from "@/lib/proxy-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { path?: string[] } | Promise<{ path?: string[] }>;
};

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await Promise.resolve(context.params);
  const backendBaseUrl = resolveBackendApiUrl();
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${backendBaseUrl}/${path.join("/")}${incomingUrl.search}`);
  const headers = new Headers(request.headers);

  for (const header of hopByHopHeaders) {
    headers.delete(header);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual"
  });

  const responseHeaders = new Headers(response.headers);
  appendSetCookieHeaders(responseHeaders, response.headers);

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
