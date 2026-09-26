import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, sameOrigin, db } from "@/lib/server";
import { current, today } from "@/lib/model";
import { advanceSchema } from "@/lib/advance";
import { uploadProof, removeUnusedProof } from "@/lib/proofs";
import { incomeSchema } from "@/lib/income";
const year = z.number().int().min(2000).max(2100),
  month = z.number().int().min(1).max(12),
  amount = z
    .number()
    .min(0)
    .max(1000000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    );
const member = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    join_year: year,
    join_month: month,
    leave_year: year.nullable(),
    leave_month: month.nullable(),
    is_active: z.boolean(),
    display_order: z.number().int().min(0).max(9999),
  })
  .refine((m) => (m.leave_year === null) === (m.leave_month === null))
  .refine(
    (m) =>
      m.leave_year === null ||
      m.leave_year * 12 + m.leave_month! >= m.join_year * 12 + m.join_month,
  )
  .refine((m) => m.is_active === (m.leave_year === null));
const payment = z
  .object({
    member_id: z.string().uuid(),
    year,
    month,
    amount_paid: amount,
    payment_date: date.nullable(),
    note: z.string().max(500).default(""),
    remove_screenshot: z.boolean().default(false),
  })
  .refine((p) => p.amount_paid === 0 || !!p.payment_date)
  .refine((p) => !p.payment_date || p.payment_date <= today());
const notice = z
  .object({
    id: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(1500),
    start_date: date.nullable(),
    end_date: date.nullable(),
    is_active: z.boolean(),
  })
  .refine((n) => !n.start_date || !n.end_date || n.start_date <= n.end_date);
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "अवैध विनंती." }, { status: 403 });
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "प्रवेश कालावधी संपला. पुन्हा प्रवेश करा." },
      { status: 401 },
    );
  let uploaded: string | null = null;
  const client = db(true);
  try {
    if (
      Number(req.headers.get("content-length") ?? 0) >
      2 * 1024 * 1024 + 20000
    )
      return NextResponse.json(
        { error: "फाइल २ MB पेक्षा लहान असावी." },
        { status: 413 },
      );
    const { entity } = await params;
    const form = await req.formData();
    const raw = JSON.parse(String(form.get("payload")));
    let result;
    if (entity === "advance") {
      const p = advanceSchema.parse(raw);
      const previous = await client
        .from("payments")
        .select("year,month,screenshot_path")
        .eq("member_id", p.member_id);
      if (previous.error) throw previous.error;
      const file = form.get("file");
      if (file instanceof File && file.size)
        uploaded = await uploadProof(file, `payments/advance/${p.member_id}`);
      result = await client.rpc("save_advance", {
        p_request: p.request_id,
        p_member: p.member_id,
        p_entries: p.entries,
        p_date: p.payment_date,
        p_path: uploaded,
        p_note: p.note,
      });
      if (!result.error) {
        const oldPaths = new Set(
          (previous.data ?? [])
            .filter((r) =>
              p.entries.some((e) => e.year === r.year && e.month === r.month),
            )
            .map((r) => r.screenshot_path)
            .filter(Boolean),
        );
        for (const path of oldPaths) await removeUnusedProof(path);
        if (uploaded) await removeUnusedProof(uploaded);
      }
    } else if (entity === "income") {
      if (raw.delete) {
        const id = z.string().uuid().parse(raw.id);
        result = await client
          .from("additional_income")
          .delete()
          .eq("id", id)
          .select("id")
          .single();
      } else {
        const p = incomeSchema.parse(raw);
        result = p.id
          ? await client
              .from("additional_income")
              .update(p)
              .eq("id", p.id)
              .select("id")
              .single()
          : await client
              .from("additional_income")
              .insert(p)
              .select("id")
              .single();
      }
    } else if (entity === "members") {
      const p = member.parse(raw);
      result = p.id
        ? await client
            .from("members")
            .update(p)
            .eq("id", p.id)
            .select("id")
            .single()
        : await client.from("members").insert(p).select("id").single();
    } else if (entity === "notices") {
      if (raw.delete) {
        const id = z.string().uuid().parse(raw.id);
        result = await client
          .from("notices")
          .delete()
          .eq("id", id)
          .select("id")
          .single();
      } else {
        const p = notice.parse(raw);
        result = p.id
          ? await client
              .from("notices")
              .update(p)
              .eq("id", p.id)
              .select("id")
              .single()
          : await client.from("notices").insert(p).select("id").single();
      }
    } else if (entity === "settings") {
      const p = z
        .object({
          year: year.refine((y) => y > current().year),
          monthly_amount: amount.refine((n) => n > 0),
        })
        .parse(raw);
      result = await client
        .from("yearly_settings")
        .upsert(p, { onConflict: "year" });
    } else if (entity === "payments") {
      const p = payment.parse(raw);
      const existing = await client
        .from("payments")
        .select("screenshot_path")
        .eq("member_id", p.member_id)
        .eq("year", p.year)
        .eq("month", p.month)
        .maybeSingle();
      if (existing.error) throw existing.error;
      let path = p.remove_screenshot
        ? null
        : (existing.data?.screenshot_path ?? null);
      const file = form.get("file");
      if (file instanceof File && file.size) {
        if (file.size > 2 * 1024 * 1024) throw Error("UPLOAD");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const webp =
          String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
        const png =
          bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71;
        const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!webp && !png && !jpg) throw Error("UPLOAD");
        const ext = webp ? "webp" : png ? "png" : "jpg";
        uploaded = `payments/${p.year}/${String(p.month).padStart(2, "0")}/${p.member_id}-${crypto.randomUUID()}.${ext}`;
        const r = await client.storage
          .from("payment-proofs")
          .upload(uploaded, bytes, {
            contentType: "image/" + (jpg ? "jpeg" : ext),
            upsert: false,
          });
        if (r.error) throw r.error;
        path = uploaded;
      }
      result = await client.rpc("save_payment", {
        p_member: p.member_id,
        p_year: p.year,
        p_month: p.month,
        p_paid: p.amount_paid,
        p_date: p.payment_date,
        p_path: path,
        p_note: p.note,
      });
      if (
        !result.error &&
        existing.data?.screenshot_path &&
        existing.data.screenshot_path !== path
      )
        await removeUnusedProof(existing.data.screenshot_path);
    } else return NextResponse.json({ error: "अवैध विनंती." }, { status: 404 });
    if (result?.error) throw result.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (uploaded) await removeUnusedProof(uploaded);
    const validation = e instanceof z.ZodError;
    const message = validation
      ? "माहिती तपासा. नाव, रक्कम किंवा दिनांक योग्य नाही."
      : (e as { message?: string })?.message;
    const safe = message?.includes("BATCH_CHANGED")
      ? "ही विनंती आधीच नोंदवली आहे. फॉर्म बंद करून पुन्हा उघडा."
      : message?.includes("HISTORY")
        ? "या बदलामुळे जुनी वर्गणी नोंद अपात्र ठरेल. सुरुवातीचा किंवा शेवटचा महिना तपासा."
        : message?.includes("INELIGIBLE")
          ? "या महिन्यात सदस्याची वर्गणी लागू होत नाही."
          : message?.includes("UPLOAD")
            ? "JPG, PNG किंवा WebP चित्र वापरा; कमाल २ MB."
            : validation
              ? message
              : "माहिती जतन करता आली नाही. कृपया पुन्हा प्रयत्न करा.";
    return NextResponse.json(
      { error: safe },
      { status: validation ? 400 : 422 },
    );
  }
}
