import { connection } from "next/server";
import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { ensureDriveRoot } from "@/lib/google-drive";
import {
  encryptToken,
  exchangeAuthCode,
  readOAuthState,
} from "@/lib/google-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const state = readOAuthState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  const destination = (status: string) =>
    NextResponse.redirect(`${getSiteUrl()}/profile?drive=${status}`);

  if (!state || !code) {
    return destination("error");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.id !== state.userId) {
    return destination("error");
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", state.familyId)
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!membership) {
    return destination("error");
  }

  try {
    const refreshToken = await exchangeAuthCode(code);
    if (!refreshToken) {
      return destination("error");
    }

    const ciphertext = encryptToken(refreshToken);
    const { data: existing } = await supabase
      .from("google_drive_connections")
      .select("family_id")
      .eq("family_id", state.familyId)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from("google_drive_connections")
          .update({
            refresh_token_ciphertext: ciphertext,
            updated_at: new Date().toISOString(),
          })
          .eq("family_id", state.familyId)
      : await supabase.from("google_drive_connections").insert({
          family_id: state.familyId,
          refresh_token_ciphertext: ciphertext,
        });

    if (error) {
      console.error("googleCallback", error.code);
      return destination("error");
    }

    await ensureDriveRoot(state.familyId);
    return destination("connected");
  } catch (callbackError) {
    console.error(
      "googleCallback",
      callbackError instanceof Error ? callbackError.name : "unknown",
    );
    return destination("error");
  }
}
