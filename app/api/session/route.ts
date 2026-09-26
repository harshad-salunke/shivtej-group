import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import {
  authenticated,
  createSession,
  logout,
  sameOrigin,
  db,
  ipHash,
  configured,
} from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { authenticated: await authenticated() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "अवैध विनंती." }, { status: 403 });
  if (
    !configured() ||
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  )
    return NextResponse.json(
      { error: "व्यवस्थापक प्रवेश अद्याप कॉन्फिगर केलेला नाही." },
      { status: 503 },
    );
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 2048)
      return NextResponse.json({ error: "अवैध विनंती." }, { status: 400 });
    const { password } = await req.json();
    if (typeof password !== "string" || password.length > 128)
      return NextResponse.json({ error: "अवैध पासवर्ड." }, { status: 400 });
    const limit = await db(true).rpc("admin_login_attempt", {
      ip_key: ipHash(req),
    });
    if (limit.error) throw limit.error;
    if (!limit.data)
      return NextResponse.json(
        { error: "खूप प्रयत्न झाले. १५ मिनिटांनी पुन्हा प्रयत्न करा." },
        { status: 429 },
      );
    if (!(await compare(password, process.env.ADMIN_PASSWORD_HASH)))
      return NextResponse.json(
        { error: "पासवर्ड चुकीचा आहे." },
        { status: 401 },
      );
    await createSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "प्रवेश सध्या उपलब्ध नाही. पुन्हा प्रयत्न करा." },
      { status: 503 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "अवैध विनंती." }, { status: 403 });
  await logout();
  return NextResponse.json({ ok: true });
}
