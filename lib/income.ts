import { z } from "zod";
export const incomeKinds = {
  donation: "देणगी / इतर जमा",
  opening_balance: "मागील शिल्लक",
} as const;
export const incomeSchema = z.object({
  id: z.string().uuid().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  kind: z.enum(["donation", "opening_balance"]),
  source: z.string().trim().min(1).max(120),
  amount: z
    .number()
    .positive()
    .max(1000000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    ),
  note: z.string().trim().max(500).default(""),
});
export type Income = Omit<z.infer<typeof incomeSchema>, "id"> & { id: string };
