import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { safeNextPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? getSiteUrl()
    : new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${siteUrl}${next}`);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  const response = NextResponse.redirect(`${siteUrl}/login?error=auth`);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
