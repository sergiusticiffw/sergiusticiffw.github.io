import { z } from "zod";

const birthDate = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        date.getTime() <= Date.now()
      );
    },
    { message: "Data nașterii nu este validă." },
  );

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Numele este obligatoriu." })
    .max(120, { message: "Numele este prea lung." }),
  birthDate,
  idnp: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{13}$/.test(value), {
      message: "IDNP are 13 cifre.",
    }),
  notes: z
    .string()
    .trim()
    .max(2000, { message: "Notele pot avea cel mult 2000 de caractere." }),
});

export const profileIdSchema = z.uuid({ message: "Profilul nu este valid." });

export type ProfileInput = z.infer<typeof profileSchema>;
