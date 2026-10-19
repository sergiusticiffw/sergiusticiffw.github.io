import { Suspense } from "react";

import {
  FamilyManager,
  type AccessProfile,
  type FamilyInvite,
  type FamilyMember,
  type ProfileGrant,
} from "@/components/family/family-manager";
import { getFamilyAccess, type FamilyRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Familie",
};

const roles: FamilyRole[] = ["admin", "editor", "viewer"];

function asRole(value: string): FamilyRole {
  return roles.includes(value as FamilyRole) ? (value as FamilyRole) : "viewer";
}

export default function FamilyPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Familie</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Se încarcă familia…</p>}>
        <FamilySection />
      </Suspense>
    </div>
  );
}

async function FamilySection() {
  const access = await getFamilyAccess();
  if (!access.familyId || !access.role) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {access.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [familyResult, membersResult, invitesResult] = await Promise.all([
    supabase.from("families").select("name").eq("id", access.familyId).maybeSingle(),
    supabase
      .from("family_members")
      .select("user_id, email, role")
      .eq("family_id", access.familyId)
      .order("email", { ascending: true }),
    access.role === "admin"
      ? supabase
          .from("family_invites")
          .select("email, role")
          .eq("family_id", access.familyId)
          .order("email", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const listError = familyResult.error ?? membersResult.error ?? invitesResult.error;
  if (listError) {
    console.error("familyPage", listError.code);
    return (
      <p role="alert" className="text-sm text-destructive">
        Familia nu a putut fi încărcată. Aplică migrația pentru accesul membrilor.
      </p>
    );
  }

  const family = familyResult.data as { name: string } | null;
  const members = ((membersResult.data ?? []) as {
    user_id: string;
    email: string | null;
    role: string;
  }[]).map(
    (member): FamilyMember => ({
      user_id: member.user_id,
      email: member.email,
      role: asRole(member.role),
    }),
  );
  const invites = ((invitesResult.data ?? []) as { email: string; role: string }[]).map(
    (invite): FamilyInvite => ({
      email: invite.email,
      role: asRole(invite.role),
    }),
  );

  let profiles: AccessProfile[] = [];
  let grants: ProfileGrant[] = [];
  let accessNote: string | null = null;
  if (access.role === "admin") {
    const [profilesResult, grantsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("family_id", access.familyId)
        .order("display_name", { ascending: true }),
      supabase.from("profile_access").select("profile_id, user_id"),
    ]);
    if (profilesResult.error) {
      console.error("familyProfiles", profilesResult.error.code);
      accessNote = "Profilurile nu au putut fi încărcate.";
    } else {
      profiles = (profilesResult.data ?? []) as AccessProfile[];
    }
    if (grantsResult.error) {
      console.error("familyGrants", grantsResult.error.code);
      accessNote = "Aplică migrația pentru accesul pe profil.";
    } else {
      grants = (grantsResult.data ?? []) as ProfileGrant[];
    }
  }

  return (
    <FamilyManager
      name={family?.name ?? "Familie"}
      members={members}
      invites={invites}
      profiles={profiles}
      grants={grants}
      accessNote={accessNote}
      isAdmin={access.role === "admin"}
    />
  );
}
