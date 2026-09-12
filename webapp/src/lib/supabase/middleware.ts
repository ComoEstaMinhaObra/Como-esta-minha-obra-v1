import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/config/env";
import type { Database } from "@/lib/database.types";

function ehRotaProtegida(pathname: string): boolean {
  if (pathname.startsWith("/obras")) return true;
  if (pathname.startsWith("/planos")) return true;
  if (pathname.startsWith("/conta")) return true;
  if (pathname.startsWith("/c/")) return true;
  if (pathname.startsWith("/admin")) return true;
  return false;
}

function ehRotaComNonce(pathname: string): boolean {
  return (
    pathname.startsWith("/entrar") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/obras") ||
    pathname.startsWith("/planos") ||
    pathname.startsWith("/conta") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/admin")
  );
}

function montarCsp(nonce: string, supabaseOrigin: string): string {
  const turnstile = "https://challenges.cloudflare.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${turnstile}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseOrigin} ${turnstile}`,
    `frame-src ${turnstile} ${supabaseOrigin}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const { pathname } = request.nextUrl;
  const supabaseOrigin = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const csp = montarCsp(nonce, supabaseOrigin);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // O Next.js extrai o nonce do CSP recebido na requisição e o propaga para
  // scripts próprios. Mesmo em Report-Only, este header interno é necessário.
  requestHeaders.set("Content-Security-Policy", csp);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && ehRotaProtegida(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c);
    });
    aplicarHeaders(redirect, nonce, pathname, csp);
    return redirect;
  }

  aplicarHeaders(supabaseResponse, nonce, pathname, csp);
  return supabaseResponse;
}

function aplicarHeaders(
  res: NextResponse,
  nonce: string,
  pathname: string,
  csp: string,
) {
  const enforce =
    process.env.NODE_ENV === "production" && process.env.CSP_ENFORCE === "true";
  res.headers.set(
    enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    csp,
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  if (ehRotaComNonce(pathname)) {
    res.headers.set("x-nonce", nonce);
  }
}
