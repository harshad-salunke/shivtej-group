import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Data,
  type Member,
  summary,
  eligible,
  previousDues,
  record,
  current,
  memberYear,
} from "../lib/model";
const m: Member = {
  id: "a",
  name: "अमोल",
  join_year: 2027,
  join_month: 4,
  leave_year: 2027,
  leave_month: 8,
  is_active: false,
  display_order: 1,
};
const base: Data = {
  members: [m],
  payments: [],
  settings: [
    { year: 2027, monthly_amount: 300 },
    { year: 2028, monthly_amount: 500 },
  ],
  notices: [],
  demo: false,
  storageUrl: "",
};
test("Joining and leaving are inclusive; inactive members retain historic obligations", () => {
  assert.equal(eligible(m, 2027, 3), false);
  assert.equal(eligible(m, 2027, 4), true);
  assert.equal(eligible(m, 2027, 8), true);
  assert.equal(eligible(m, 2027, 9), false);
  assert.equal(summary(base, 2027, 7).due, 300);
});
test("Overpayment never clears another member’s debt", () => {
  const d = structuredClone(base);
  d.members.push({ ...m, id: "b" });
  d.payments.push({
    id: "p",
    member_id: "a",
    year: 2027,
    month: 4,
    expected_amount: 300,
    amount_paid: 500,
    payment_date: "2027-04-05",
    screenshot_path: null,
    note: "",
  });
  const s = summary(d, 2027, 4);
  assert.equal(s.expected, 600);
  assert.equal(s.paid, 500);
  assert.equal(s.due, 300);
});
test("Snapshot expected amount survives settings change; partial status is derived", () => {
  const d = structuredClone(base);
  d.settings[0].monthly_amount = 500;
  d.payments.push({
    id: "p",
    member_id: "a",
    year: 2027,
    month: 4,
    expected_amount: 300,
    amount_paid: 200,
    payment_date: "2027-04-05",
    screenshot_path: null,
    note: "",
  });
  const r = record(d, m, 2027, 4);
  assert.equal(r.expected, 300);
  assert.equal(r.due, 100);
  assert.equal(r.status, "partial");
});
test("Previous dues cross year boundary and never charge future months", () => {
  const now = current();
  const d = structuredClone(base);
  d.members = [
    {
      ...m,
      join_year: now.year - 1,
      join_month: 12,
      leave_year: null,
      leave_month: null,
      is_active: true,
    },
  ];
  d.settings = [];
  const dues = previousDues(d, now.year, 2);
  const count = Math.min(now.month, 2);
  assert.equal(dues[0].entries.length, count);
  assert.equal(dues[0].total, count * 300);
  assert.equal(previousDues(d, now.year + 1, 1)[0].entries.length, now.month);
});
test("Future annual view does not invent arrears", () => {
  const now = current();
  assert.equal(
    memberYear(
      {
        ...base,
        members: [
          {
            ...m,
            join_year: now.year,
            join_month: 1,
            leave_year: null,
            leave_month: null,
          },
        ],
      },
      m,
      now.year + 1,
    ).due,
    0,
  );
});
