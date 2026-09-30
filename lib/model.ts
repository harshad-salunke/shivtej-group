import type { Income } from "./income";
export type Member = {
  id: string;
  name: string;
  join_year: number;
  join_month: number;
  leave_year: number | null;
  leave_month: number | null;
  is_active: boolean;
  display_order: number;
};
export type Payment = {
  id: string;
  member_id: string;
  year: number;
  month: number;
  expected_amount: number;
  amount_paid: number;
  payment_date: string | null;
  screenshot_path: string | null;
  note: string;
};
export type Notice = {
  id: string;
  message: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};
export type Setting = { year: number; monthly_amount: number };
export type Data = {
  advance_batches?: string[];
  additional_income?: Income[];
  members: Member[];
  payments: Payment[];
  notices: Notice[];
  settings: Setting[];
  demo: boolean;
  storageUrl: string;
};
export const months = [
  "जानेवारी",
  "फेब्रुवारी",
  "मार्च",
  "एप्रिल",
  "मे",
  "जून",
  "जुलै",
  "ऑगस्ट",
  "सप्टेंबर",
  "ऑक्टोबर",
  "नोव्हेंबर",
  "डिसेंबर",
];
export const shortMonths = [
  "जाने",
  "फेब्रु",
  "मार्च",
  "एप्रिल",
  "मे",
  "जून",
  "जुलै",
  "ऑग",
  "सप्टें",
  "ऑक्टो",
  "नोव्हें",
  "डिसें",
];
export const num = (n: number) =>
  new Intl.NumberFormat("en-IN", { useGrouping: false }).format(n);
export const money = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
export function current() {
  const [year, month] = today().split("-").map(Number);
  return { year, month };
}
export const serial = (y: number, m: number) => y * 12 + m;
export function eligible(m: Member, y: number, mo: number) {
  const s = serial(y, mo);
  return (
    s >= serial(m.join_year, m.join_month) &&
    (m.leave_year === null || s <= serial(m.leave_year, m.leave_month!))
  );
}
export function rate(d: Data, y: number) {
  return (
    [...d.settings]
      .filter((s) => s.year <= y)
      .sort((a, b) => b.year - a.year)[0]?.monthly_amount ?? 300
  );
}
export function record(d: Data, m: Member, y: number, mo: number) {
  const p = d.payments.find(
    (p) => p.member_id === m.id && p.year === y && p.month === mo,
  );
  const expected = p?.expected_amount ?? rate(d, y);
  const paid = p?.amount_paid ?? 0;
  return {
    member: m,
    p,
    expected,
    paid,
    due: Math.max(0, expected - paid),
    status: paid >= expected ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}
export function monthRows(d: Data, y: number, mo: number) {
  return d.members
    .filter((m) => eligible(m, y, mo))
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name, "mr"),
    )
    .map((m) => record(d, m, y, mo));
}
export function summary(d: Data, y: number, mo: number) {
  const rows = monthRows(d, y, mo);
  const funds = fundSummary(d, y, mo);
  return {
    ...funds,
    rows,
    expected: rows.reduce((a, r) => a + r.expected, 0),
    paid: rows.reduce((a, r) => a + r.paid, 0),
    due: rows.reduce((a, r) => a + r.due, 0),
    full: rows.filter((r) => r.status === "paid").length,
    partial: rows.filter((r) => r.status === "partial").length,
    unpaid: rows.filter((r) => r.status === "unpaid").length,
  };
}
// Opening balances belong to exactly one selected period. Never roll them
// automatically into other months or subtract them from member arrears.
export function fundSummary(d: Data, y: number, mo?: number) {
  const entries = (d.additional_income ?? []).filter(
    (e) => e.year === y && (mo === undefined || e.month === mo),
  );
  const cents = (n: number) => Math.round(n * 100);
  const memberPaid =
    d.payments
      .filter((p) => p.year === y && (mo === undefined || p.month === mo))
      .reduce((a, p) => a + cents(p.amount_paid), 0) / 100;
  const donations =
    entries
      .filter((e) => e.kind === "donation")
      .reduce((a, e) => a + cents(e.amount), 0) / 100;
  const openingBalance =
    entries
      .filter((e) => e.kind === "opening_balance")
      .reduce((a, e) => a + cents(e.amount), 0) / 100;
  return {
    entries,
    memberPaid,
    donations,
    openingBalance,
    extra: (cents(donations) + cents(openingBalance)) / 100,
    total: (cents(memberPaid) + cents(donations) + cents(openingBalance)) / 100,
  };
}
export function previousDues(d: Data, y: number, mo: number) {
  const now = current();
  const end = Math.min(serial(y, mo) - 1, serial(now.year, now.month) - 1);
  return d.members
    .map((m) => {
      const entries = [];
      for (let s = serial(m.join_year, m.join_month); s <= end; s++) {
        const yy = Math.floor((s - 1) / 12),
          mm = ((s - 1) % 12) + 1;
        if (eligible(m, yy, mm)) {
          const r = record(d, m, yy, mm);
          if (r.due > 0) entries.push({ year: yy, month: mm, due: r.due });
        }
      }
      return {
        member: m,
        entries,
        total: entries.reduce((a, e) => a + e.due, 0),
      };
    })
    .filter((r) => r.total > 0);
}
export function memberYear(d: Data, m: Member, y: number) {
  const now = current();
  const end = y < now.year ? 12 : y === now.year ? now.month : 0;
  const rows = Array.from({ length: end }, (_, i) => i + 1)
    .filter((mo) => eligible(m, y, mo))
    .map((mo) => record(d, m, y, mo));
  return {
    count: rows.length,
    full: rows.filter((r) => !r.due).length,
    due: rows.reduce((a, r) => a + r.due, 0),
    paid: d.payments
      .filter((p) => p.member_id === m.id && p.year === y)
      .reduce((a, p) => a + p.amount_paid, 0),
  };
}
export function sampleData(): Data {
  const { year, month } = current();
  const names = [
    "अमोल पाटील",
    "गणेश पाटील",
    "सचिन जाधव",
    "राहुल शिंदे",
    "प्रशांत पवार",
    "विशाल मोरे",
    "अक्षय चव्हाण",
    "सागर कदम",
    "रोहित जाधव",
    "नितीन पाटील",
    "संदीप शिंदे",
    "स्वप्निल पवार",
    "संतोष मोरे",
    "महेश चव्हाण",
    "विकास कदम",
    "दीपक पाटील",
    "अभिजीत शिंदे",
    "ओंकार जाधव",
    "अजय पवार",
    "शुभम मोरे",
    "चेतन कदम",
    "तुषार चव्हाण",
  ];
  const members = names.map((name, i) => ({
    id: "demo-" + i,
    name,
    join_year: year,
    join_month: Math.max(1, month - 2),
    leave_year: null,
    leave_month: null,
    is_active: true,
    display_order: i + 1,
  }));
  const payments: Payment[] = [];
  for (let mo = Math.max(1, month - 2); mo <= month; mo++)
    members.forEach((m, i) => {
      const paid =
        mo === month ? (i < 17 ? 300 : i < 19 ? 200 : 0) : i === 1 ? 0 : 300;
      payments.push({
        id: `${m.id}-${mo}`,
        member_id: m.id,
        year,
        month: mo,
        amount_paid: paid,
        expected_amount: 300,
        payment_date: paid ? `${year}-${String(mo).padStart(2, "0")}-05` : null,
        screenshot_path: null,
        note: "",
      });
    });
  return {
    members,
    payments,
    additional_income: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        year,
        month,
        kind: "opening_balance",
        source: "मागील वर्षाची शिल्लक — नमुना",
        amount: 10000,
        entry_date: today(),
        note: "केवळ नमुना नोंद; ही रक्कम एकदाच मोजली जाते.",
      },
    ],
    settings: [{ year, monthly_amount: 300 }],
    notices: [
      {
        id: "demo-notice",
        message:
          "साऊंड सिस्टीमसाठी एकत्र येऊया! या महिन्याची वर्गणी 10 तारखेपर्यंत जमा करावी.",
        start_date: null,
        end_date: null,
        is_active: true,
      },
    ],
    demo: true,
    storageUrl: "",
  };
}
