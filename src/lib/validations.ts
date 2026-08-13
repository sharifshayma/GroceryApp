import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(1),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const createHouseholdSchema = z.object({ name: z.string().trim().min(1) });
export const joinHouseholdSchema = z.object({ code: z.string().trim().length(8) });
