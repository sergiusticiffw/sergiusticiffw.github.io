"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  createProfile,
  updateProfile,
} from "@/app/(app)/profiles/actions";
import {
  emptyIdentityDraft,
  ProfileIdentityFields,
  saveIdentityDraft,
  type IdentityDraft,
  type ProfileIdentityDoc,
} from "@/components/profiles/profile-identity-docs";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

const emptyValues: ProfileInput = {
  displayName: "",
  birthDate: "",
  idnp: "",
  notes: "",
};

export function ProfileForm({
  profileId,
  formId,
  defaultValues = emptyValues,
  submitLabel,
  hideActions = false,
  onDone,
  onPendingChange,
  identityDoc = null,
  driveConnected = false,
}: {
  profileId?: string;
  formId?: string;
  defaultValues?: ProfileInput;
  submitLabel: string;
  hideActions?: boolean;
  onDone?: () => void;
  onPendingChange?: (pending: boolean) => void;
  identityDoc?: ProfileIdentityDoc | null;
  driveConnected?: boolean;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [identityCleared, setIdentityCleared] = useState(false);
  const [identityDraft, setIdentityDraft] = useState<IdentityDraft>(() =>
    emptyIdentityDraft(identityDoc),
  );
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });
  const idPrefix = profileId ?? formId ?? "profile";
  const activeIdentityDoc = identityCleared ? null : identityDoc;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    onPendingChange?.(true);
    try {
      const result = profileId
        ? await updateProfile(profileId, values)
        : await createProfile(values);

      if (result.error) {
        setFormError(result.error);
        return;
      }

      const savedProfileId = profileId ?? result.id;
      if (!savedProfileId) {
        setFormError("Profilul a fost salvat, dar actul nu a putut fi legat.");
        return;
      }
      const identityResult = await saveIdentityDraft({
        profileId: savedProfileId,
        existing: activeIdentityDoc,
        draft: identityDraft,
        driveConnected,
      });
      if (identityResult.error) {
        setFormError(identityResult.error);
        return;
      }

      if (!profileId) {
        form.reset(emptyValues);
        setIdentityDraft(emptyIdentityDraft(null));
        setIdentityCleared(false);
      }
      onDone?.();
    } finally {
      onPendingChange?.(false);
    }
  });

  return (
    <form
      id={formId}
      method="post"
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={profileId ? `name-${profileId}` : "name"}>Nume</Label>
        <Input
          id={profileId ? `name-${profileId}` : "name"}
          autoComplete="name"
          className="h-11"
          aria-invalid={Boolean(form.formState.errors.displayName)}
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.displayName.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={profileId ? `birth-${profileId}` : "birth"}>
          Data nașterii
        </Label>
        <Input
          id={profileId ? `birth-${profileId}` : "birth"}
          type="date"
          className="h-11"
          aria-invalid={Boolean(form.formState.errors.birthDate)}
          {...form.register("birthDate")}
        />
        {form.formState.errors.birthDate ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.birthDate.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={profileId ? `idnp-${profileId}` : "idnp"}>IDNP</Label>
        <Input
          id={profileId ? `idnp-${profileId}` : "idnp"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={13}
          className="h-11"
          aria-invalid={Boolean(form.formState.errors.idnp)}
          {...form.register("idnp")}
        />
        {form.formState.errors.idnp ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.idnp.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            13 cifre. Documentele scanate se asociază după acest număr.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={profileId ? `notes-${profileId}` : "notes"}>Note</Label>
        <Textarea
          id={profileId ? `notes-${profileId}` : "notes"}
          className="min-h-24"
          aria-invalid={Boolean(form.formState.errors.notes)}
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.notes.message}
          </p>
        ) : null}
      </div>
      <ProfileIdentityFields
        idPrefix={idPrefix}
        doc={activeIdentityDoc}
        draft={identityDraft}
        onChange={setIdentityDraft}
        driveConnected={driveConnected}
        onDeleted={() => setIdentityCleared(true)}
      />
      {hideActions ? null : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            className="h-11 sm:min-w-36"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Se salvează…" : submitLabel}
          </Button>
          {onDone ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={onDone}
            >
              Renunță
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}

export function AddProfileButton({
  driveConnected = false,
}: {
  driveConnected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formId = "add-profile-form";

  return (
    <>
      <Button type="button" className="h-11 sm:w-fit" onClick={() => setOpen(true)}>
        Adaugă profil
      </Button>
      <FormDialog
        open={open}
        title="Adaugă profil"
        pending={pending}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
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
              form={formId}
              className="h-11 sm:w-fit"
              disabled={pending}
            >
              {pending ? "Se salvează…" : "Adaugă profil"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Numele, data nașterii și IDNP-ul. Documentele scanate se asociază
          după IDNP și rămân în folderul privat din Google Drive.
        </p>
        <ProfileForm
          key={open ? "open" : "closed"}
          formId={formId}
          submitLabel="Adaugă profil"
          hideActions
          driveConnected={driveConnected}
          onDone={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </FormDialog>
    </>
  );
}
