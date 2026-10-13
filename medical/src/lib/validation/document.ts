import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "Analize",
  "Consultație",
  "Trimiteri",
  "Rețete",
  "Imagistică",
  "Alte documente",
] as const;

export const documentSchema = z.object({
  profileId: z.uuid({ message: "Profilul nu este valid." }),
  documentDate: z.string().trim().refine(
    (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    { message: "Data documentului nu este validă." },
  ),
  category: z.enum(DOCUMENT_CATEGORIES, { message: "Alege categoria." }),
});

export type DocumentInput = z.infer<typeof documentSchema>;
