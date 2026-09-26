import { NextResponse } from "next/server";
import { configured, db, authenticated } from "@/lib/server";
import { sampleData } from "@/lib/model";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!configured())
    return NextResponse.json(sampleData(), {
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const isAdmin = await authenticated();
    const client = db(isAdmin);
    async function all(table: string, columns: string, order: string) {
      const rows: any[] = [];
      for (let start = 0; ; start += 1000) {
        const r = await client
          .from(table)
          .select(columns)
          .order(order)
          .range(start, start + 999);
        if (r.error) throw r.error;
        rows.push(...(r.data ?? []));
        if ((r.data?.length ?? 0) < 1000) return rows;
      }
    }
    const [members, payments, settings, notices, additional_income] =
      await Promise.all([
        all(
          "members",
          "id,name,join_year,join_month,leave_year,leave_month,is_active,display_order",
          "id",
        ),
        all(
          "payments",
          "id,member_id,year,month,expected_amount,amount_paid,payment_date,screenshot_path,note",
          "id",
        ),
        all("yearly_settings", "year,monthly_amount", "year"),
        all("notices", "id,message,start_date,end_date,is_active", "id"),
        all(
          "additional_income",
          "id,year,month,kind,source,amount,entry_date,note",
          "id",
        ),
      ]);
    return NextResponse.json(
      {
        members,
        payments,
        settings,
        notices,
        additional_income,
        demo: false,
        storageUrl:
          process.env.NEXT_PUBLIC_SUPABASE_URL +
          "/storage/v1/object/public/payment-proofs",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "माहिती सध्या उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा." },
      { status: 503 },
    );
  }
}
