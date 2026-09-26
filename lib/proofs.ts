import "server-only";
import { db } from "./server";
export async function uploadProof(file: File, prefix: string) {
  if (file.size > 2097152) throw Error("UPLOAD");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const png =
    bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!webp && !png && !jpg) throw Error("UPLOAD");
  const ext = webp ? "webp" : png ? "png" : "jpg";
  const path = `${prefix}-${crypto.randomUUID()}.${ext}`;
  const r = await db(true)
    .storage.from("payment-proofs")
    .upload(path, bytes, {
      contentType: "image/" + (jpg ? "jpeg" : ext),
      upsert: false,
    });
  if (r.error) throw r.error;
  return path;
}
export async function removeUnusedProof(path: string) {
  const client = db(true);
  const r = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("screenshot_path", path);
  if (!r.error && r.count === 0)
    await client.storage.from("payment-proofs").remove([path]);
}
