import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  );
}

function redirectWithSession(source: NextResponse, url: URL) {
  const redirectResponse = NextResponse.redirect(url);
  source.headers.getSetCookie().forEach((cookie) => {
    redirectResponse.headers.append("set-cookie", cookie);
  });

  const cacheControl = source.headers.get("cache-control");
  if (cacheControl) {
    redirectResponse.headers.set("cache-control", cacheControl);
  }

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const env = getSupabaseEnv();

  if (!env) {
    if (isPublic) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return redirectWithSession(supabaseResponse, url);
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/profiles";
    url.search = "";
    return redirectWithSession(supabaseResponse, url);
  }

  const isPasswordUpdate = pathname === "/login/parola-noua";
  if (user && pathname.startsWith("/login") && !isPasswordUpdate) {
    const url = request.nextUrl.clone();
    url.pathname = "/profiles";
    url.search = "";
    return redirectWithSession(supabaseResponse, url);
  }

  return supabaseResponse;
}
