import { connection } from "next/server";
import { NextResponse } from "next/server";

import { getAdminFamilyId, getCurrentUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import {
  createOAuthState,
  getGoogleConfig,
  googleAuthUrl,
} from "@/lib/google-oauth";

export async function GET() {
  await connection();
  if (!getGoogleConfig()) {
    return NextResponse.redirect(`${getSiteUrl()}/profile?drive=config`);
  }

  const user = await getCurrentUser();
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return NextResponse.redirect(`${getSiteUrl()}/profile`);
  }

  const state = createOAuthState({
    userId: user.id,
    familyId: family.familyId,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
