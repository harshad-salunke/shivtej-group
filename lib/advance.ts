import { z } from "zod";
import {
  type Data,
  type Member,
  eligible,
  record,
  serial,
  today,
} from "./model";
export const advanceSchema = z
  .object({
    request_id: z.string().uuid(),
    member_id: z.string().uuid(),
    entries: z
      .array(
        z.object({
          year: z.number().int().min(2000).max(2100),
          month: z.number().int().min(1).max(12),
          amount: z
            .number()
            .positive()
            .max(1000000)
            .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
        }),
      )
      .min(1)
      .max(12),
    payment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !isNaN(Date.parse(s)) &&
          new Date(s).toISOString().slice(0, 10) === s &&
          s <= today(),
      ),
    note: z.string().max(500).default(""),
  })
  .refine(
    (p) =>
      new Set(p.entries.map((e) => serial(e.year, e.month))).size ===
      p.entries.length,
  );
export function advanceRows(
  d: Data,
  m: Member,
  year: number,
  month: number,
  count: number,
) {
  return Array.from(
    { length: Math.max(1, Math.min(12, Math.floor(count))) },
    (_, i) => {
      const value = serial(year, month) + i;
      const y = Math.floor((value - 1) / 12),
        mo = ((value - 1) % 12) + 1;
      const r = record(d, m, y, mo);
      return {
        year: y,
        month: mo,
        eligible: y <= 2100 && eligible(m, y, mo),
        paid: r.paid,
        expected: r.expected,
        amount: r.due,
      };
    },
  );
}
