"use client";

import { useActionState } from "react";

import {
  cancelInvite,
  inviteMember,
  removeMember,
  renameFamily,
  setMemberRole,
  setProfileAccess,
  type FamilyActionResult,
} from "@/app/(app)/family/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FamilyRole = "admin" | "editor" | "viewer";

const initial: FamilyActionResult = {};
const selectClass =
  "h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm";

const roleLabel: Record<FamilyRole, string> = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Doar vizualizare",
};

export type FamilyMember = {
  user_id: string;
  email: string | null;
  role: FamilyRole;
};

export type FamilyInvite = {
  email: string;
  role: FamilyRole;
};

export type AccessProfile = {
  id: string;
  display_name: string;
};

export type ProfileGrant = {
  profile_id: string;
  user_id: string;
};

function Notice({ state }: { state: FamilyActionResult }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.saved) {
    return <p className="text-sm text-muted-foreground">Salvat.</p>;
  }
  return null;
}

function RoleSelect({ name, defaultValue }: { name: string; defaultValue: FamilyRole }) {
  return (
    <select name={name} defaultValue={defaultValue} className={selectClass}>
      {(Object.keys(roleLabel) as FamilyRole[]).map((role) => (
        <option key={role} value={role}>
          {roleLabel[role]}
        </option>
      ))}
    </select>
  );
}

export function FamilyManager({
  name,
  members,
  invites,
  profiles,
  grants,
  accessNote,
  isAdmin,
}: {
  name: string;
  members: FamilyMember[];
  invites: FamilyInvite[];
  profiles: AccessProfile[];
  grants: ProfileGrant[];
  accessNote: string | null;
  isAdmin: boolean;
}) {
  const [renameState, renameAction, renamePending] = useActionState(renameFamily, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(inviteMember, initial);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? (
        <form action={renameAction} className="flex flex-col gap-2">
          <Label htmlFor="family-name">Numele familiei</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="family-name"
              name="name"
              defaultValue={name}
              required
              maxLength={120}
              className="h-11"
            />
            <Button type="submit" className="h-11" disabled={renamePending}>
              {renamePending ? "Se salvează…" : "Salvează"}
            </Button>
          </div>
          <Notice state={renameState} />
        </form>
      ) : (
        <p className="text-sm">{name}</p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Membri</h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.user_id} className="rounded-lg border px-3 py-2">
              {isAdmin ? (
                <MemberRow member={member} />
              ) : (
                <p className="text-sm">
                  {member.email ?? "Membru"} · {roleLabel[member.role]}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isAdmin ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-sm font-medium">Cine vede fiecare persoană</h2>
          <p className="text-sm text-muted-foreground">
            Bifează soțul pe profilul soției și soția pe profilul soțului, ca să
            vadă datele unul altuia. Pe profilul copilului bifează-i pe amândoi:
            fiecare poate adăuga și modifica înregistrările copilului.
            Fără bifă, persoana nu vede profilul. Doar administratorul vede tot dosarul.
          </p>
          {accessNote ? (
            <p role="alert" className="text-sm text-destructive">
              {accessNote}
            </p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adaugă întâi persoanele în dosar.
            </p>
          ) : (
            profiles.map((profile) => (
              <ProfileAccessForm
                key={profile.id}
                profile={profile}
                members={members}
                granted={grants
                  .filter((grant) => grant.profile_id === profile.id)
                  .map((grant) => grant.user_id)}
              />
            ))
          )}
        </div>
      ) : null}

      {isAdmin ? (
        <form action={inviteAction} className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-sm font-medium">Invită</h2>
          <p className="text-sm text-muted-foreground">
            Dacă persoana are deja cont, intră imediat. Altfel, invitația se
            aplică când contul este creat.
          </p>
          <Notice state={inviteState} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              className="h-11"
            />
          </div>
          <RoleSelect name="role" defaultValue="viewer" />
          <Button type="submit" className="h-11 sm:w-fit" disabled={invitePending}>
            {invitePending ? "Se invită…" : "Invită"}
          </Button>
        </form>
      ) : null}

      {isAdmin && invites.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Invitații în așteptare</h2>
          <ul className="flex flex-col gap-2">
            {invites.map((invite) => (
              <li key={invite.email}>
                <InviteRow invite={invite} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProfileAccessForm({
  profile,
  members,
  granted,
}: {
  profile: AccessProfile;
  members: FamilyMember[];
  granted: string[];
}) {
  const [state, action, pending] = useActionState(setProfileAccess, initial);
  const grantedIds = new Set(granted);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border px-3 py-3">
      <input type="hidden" name="profileId" value={profile.id} />
      <p className="text-sm font-medium">{profile.display_name}</p>
      <ul className="flex flex-col">
        {members.map((member) => (
          <li key={member.user_id}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="userId"
                value={member.user_id}
                defaultChecked={grantedIds.has(member.user_id)}
                className="size-4"
              />
              <span>
                {member.email ?? "Membru"} · {roleLabel[member.role]}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" variant="outline" className="h-11 sm:w-fit" disabled={pending}>
        {pending ? "Se salvează…" : "Salvează accesul"}
      </Button>
      <Notice state={state} />
    </form>
  );
}

function MemberRow({ member }: { member: FamilyMember }) {
  const [roleState, roleAction, rolePending] = useActionState(setMemberRole, initial);
  const [removeState, removeAction, removePending] = useActionState(removeMember, initial);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{member.email ?? "Membru"}</p>
      <form action={roleAction} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="userId" value={member.user_id} />
        <RoleSelect name="role" defaultValue={member.role} />
        <Button type="submit" variant="outline" className="h-11" disabled={rolePending}>
          {rolePending ? "Se salvează…" : "Schimbă rolul"}
        </Button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="userId" value={member.user_id} />
        <Button type="submit" variant="outline" className="h-8 text-xs" disabled={removePending}>
          {removePending ? "Se scoate…" : "Scoate din familie"}
        </Button>
      </form>
      <Notice state={roleState} />
      <Notice state={removeState} />
    </div>
  );
}

function InviteRow({ invite }: { invite: FamilyInvite }) {
  const [state, action, pending] = useActionState(cancelInvite, initial);

  return (
    <form action={action} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <input type="hidden" name="email" value={invite.email} />
      <p className="min-w-0 truncate text-sm">
        {invite.email} · {roleLabel[invite.role]}
      </p>
      <Button type="submit" variant="outline" className="h-8 text-xs" disabled={pending}>
        {pending ? "Se anulează…" : "Anulează"}
      </Button>
      <Notice state={state} />
    </form>
  );
}
