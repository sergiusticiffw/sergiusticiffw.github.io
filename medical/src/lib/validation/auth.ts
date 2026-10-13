import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Emailul este obligatoriu." })
    .max(254, { message: "Emailul este prea lung." })
    .email({ message: "Introdu un email valid." }),
  password: z
    .string()
    .min(1, { message: "Parola este obligatorie." })
    .max(72, { message: "Parola este prea lungă." }),
});

export const recoverySchema = z.object({
  email: loginSchema.shape.email,
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Parola trebuie să aibă cel puțin 8 caractere." })
      .max(72, { message: "Parola este prea lungă." }),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Parolele nu coincid.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
