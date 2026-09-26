import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
export function db(secret = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = secret
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Error("डेटाबेस जोडणी अपूर्ण आहे.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const cookieName = "shivtej_admin";
const signature = (value: string) =>
  createHmac("sha256", process.env.ADMIN_SESSION_SECRET!)
    .update(value + "|" + process.env.ADMIN_PASSWORD_HASH)
    .digest("base64url");
export async function authenticated() {
  if (!process.env.ADMIN_SESSION_SECRET || !process.env.ADMIN_PASSWORD_HASH)
    return false;
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return false;
  const expected = signature(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.exp > Date.now() && parsed.role === "admin";
  } catch {
    return false;
  }
}
export async function createSession() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, role: "admin" }),
  ).toString("base64url");
  (await cookies()).set(cookieName, payload + "." + signature(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function logout() {
  (await cookies()).delete(cookieName);
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_ORIGIN;
  return !!origin && !!expected && origin === expected.replace(/\/$/, "");
}
export function ipHash(req: Request) {
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return createHash("sha256")
    .update(ip + "|" + process.env.ADMIN_SESSION_SECRET)
    .digest("hex");
}
