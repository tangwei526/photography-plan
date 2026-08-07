import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

const sessionCookie = "shancheng_session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/api/auth" || pathname.startsWith("/api/samples")) {
    return NextResponse.next();
  }

  const configured = (env as unknown as { SITE_AUTH_SESSION?: string }).SITE_AUTH_SESSION;
  const authenticated = configured && request.cookies.get(sessionCookie)?.value === configured;
  if (authenticated) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|og.png).*)"],
};
