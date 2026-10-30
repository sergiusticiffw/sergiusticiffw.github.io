"use client";

import { startTransition, useActionState, useEffect, useState } from "react";

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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";

type FamilyRole = "admin" | "editor" | "viewer";

const initial: FamilyActionResult = {};

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
    <Select name={name} defaultValue={defaultValue} className="sm:w-auto">
      {(Object.keys(roleLabel) as FamilyRole[]).map((role) => (
        <option key={role} value={role}>
          {roleLabel[role]}
        </option>
      ))}
    </Select>
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
  roleNote = null,
}: {
  name: string;
  members: FamilyMember[];
  invites: FamilyInvite[];
  profiles: AccessProfile[];
  grants: ProfileGrant[];
  accessNote: string | null;
  isAdmin: boolean;
  roleNote?: string | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? (
        <RenameFamily name={name} />
      ) : (
        <p className="text-sm">{name}</p>
      )}

      {roleNote ? (
        <p
          role="status"
          className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"
        >
          {roleNote}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Membri</h2>
        {isAdmin ? (
          <p className="text-sm text-muted-foreground">
            Administrator și editor pot modifica înregistrările persoanelor
            bifate. „Doar vizualizare” permite doar citirea.
          </p>
        ) : null}
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
        <div className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-sm font-medium">Invită</h2>
          <p className="text-sm text-muted-foreground">
            Dacă persoana are deja cont, intră imediat. Altfel, invitația se
            aplică când contul este creat.
          </p>
          <Button
            type="button"
            className="h-11 sm:w-fit"
            onClick={() => setInviteOpen(true)}
          >
            Invită
          </Button>
          <InviteDialog
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
          />
        </div>
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

function RenameFamily({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(renameFamily, initial);

  useEffect(() => {
    if (state.saved) {
      setOpen(false);
    }
  }, [state.saved]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{name}</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        Modifică
      </Button>
      <FormDialog
        open={open}
        title="Numele familiei"
        pending={pending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Renunță
            </Button>
            <Button
              type="submit"
              form="rename-family-form"
              className="h-11 sm:w-fit"
              disabled={pending}
            >
              {pending ? "Se salvează…" : "Salvează"}
            </Button>
          </>
        }
      >
        <form
          id="rename-family-form"
          action={action}
          className="flex flex-col gap-3"
        >
          <Label htmlFor="family-name">Nume</Label>
          <Input
            id="family-name"
            name="name"
            defaultValue={name}
            required
            maxLength={120}
            className="h-11"
          />
          <Notice state={state} />
        </form>
      </FormDialog>
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(inviteMember, initial);

  useEffect(() => {
    if (state.saved) {
      onClose();
    }
  }, [state.saved, onClose]);

  return (
    <FormDialog
      open={open}
      title="Invită în familie"
      pending={pending}
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={onClose}
          >
            Renunță
          </Button>
          <Button
            type="submit"
            form="invite-member-form"
            className="h-11 sm:w-fit"
            disabled={pending}
          >
            {pending ? "Se invită…" : "Invită"}
          </Button>
        </>
      }
    >
      {open ? (
        <form
          id="invite-member-form"
          action={action}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-muted-foreground">
            Dacă persoana are deja cont, intră imediat. Altfel, invitația se
            aplică când contul este creat.
          </p>
          <Notice state={state} />
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
        </form>
      ) : null}
    </FormDialog>
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
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setProfileAccess, initial);
  const grantedIds = new Set(granted);

  useEffect(() => {
    if (state.saved) {
      setOpen(false);
    }
  }, [state.saved]);

  const grantedLabel = members
    .filter((member) => grantedIds.has(member.user_id))
    .map((member) => member.email ?? "Membru")
    .join(", ");

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{profile.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {grantedLabel || "Nimeni în afara administratorului"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        Modifică
      </Button>
      <FormDialog
        open={open}
        title={`Acces · ${profile.display_name}`}
        pending={pending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Renunță
            </Button>
            <Button
              type="submit"
              form={`access-form-${profile.id}`}
              className="h-11 sm:w-fit"
              disabled={pending}
            >
              {pending ? "Se salvează…" : "Salvează accesul"}
            </Button>
          </>
        }
      >
        <form
          id={`access-form-${profile.id}`}
          action={action}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="profileId" value={profile.id} />
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
          <Notice state={state} />
        </form>
      </FormDialog>
    </div>
  );
}

function MemberRow({ member }: { member: FamilyMember }) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeUnlockPending, setRemoveUnlockPending] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState(setMemberRole, initial);
  const [removeState, removeAction, removePending] = useActionState(removeMember, initial);

  useEffect(() => {
    if (roleState.saved) {
      setOpen(false);
    }
  }, [roleState.saved]);

  useEffect(() => {
    if (removeState.saved) {
      setConfirmRemove(false);
      setOpen(false);
    }
  }, [removeState.saved]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        {member.email ?? "Membru"} · {roleLabel[member.role]}
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        Modifică
      </Button>
      <FormDialog
        open={open}
        title={member.email ?? "Membru"}
        pending={rolePending || removePending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={rolePending || removePending}
              onClick={() => setOpen(false)}
            >
              Renunță
            </Button>
            <Button
              type="submit"
              form={`member-role-${member.user_id}`}
              className="h-11 sm:w-fit"
              disabled={rolePending || removePending}
            >
              {rolePending ? "Se salvează…" : "Salvează rolul"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <form
            id={`member-role-${member.user_id}`}
            action={roleAction}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="userId" value={member.user_id} />
            <Label>Rol</Label>
            <RoleSelect name="role" defaultValue={member.role} />
            <Notice state={roleState} />
          </form>
          <div className="border-t pt-3">
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={removePending || rolePending}
              onClick={() => setConfirmRemove(true)}
            >
              Scoate din familie
            </Button>
            <Notice state={removeState} />
          </div>
        </div>
      </FormDialog>
      <ConfirmDialog
        open={confirmRemove}
        title={`Scoți pe ${member.email ?? "acest membru"} din familie?`}
        description="Persoana pierde accesul la dosar. Poți invita din nou mai târziu."
        confirmLabel="Scoate din familie"
        pendingLabel="Se scoate…"
        pending={removePending || removeUnlockPending}
        error={removeError ?? removeState.error}
        onConfirm={() => {
          void (async () => {
            setRemoveUnlockPending(true);
            setRemoveError(null);
            const unlock = await requireSensitiveUnlock();
            setRemoveUnlockPending(false);
            if (unlock.error) {
              setRemoveError(unlock.error);
              return;
            }
            const data = new FormData();
            data.set("userId", member.user_id);
            startTransition(() => {
              removeAction(data);
            });
          })();
        }}
        onCancel={() => {
          if (!removePending && !removeUnlockPending) {
            setConfirmRemove(false);
            setRemoveError(null);
          }
        }}
      />
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
