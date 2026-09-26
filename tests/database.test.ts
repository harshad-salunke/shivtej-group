import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("Database guards, audit, public permissions, rate limit and historic snapshots", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  const sql = readFileSync("supabase/schema.sql", "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  );
  await db.exec(sql);
  const id = "11111111-1111-4111-8111-111111111111";
  await db.exec(
    `insert into public.members(id,name,join_year,join_month) values('${id}','Test',2027,4);set role service_role;select public.save_payment('${id}',2027,4,500,'2026-09-01',null,'');`,
  );
  let row = (await db.query("select * from public.payments")).rows[0] as any;
  assert.equal(Number(row.expected_amount), 300);
  await db.exec(
    `insert into public.yearly_settings(year,monthly_amount) values(2099,500);select public.save_payment('${id}',2099,1,200,'2026-09-01',null,'');update public.yearly_settings set monthly_amount=700 where year=2099;select public.save_payment('${id}',2099,1,300,'2026-09-01',null,'');`,
  );
  row = (
    await db.query(
      "select expected_amount from public.payments where year=2099",
    )
  ).rows[0] as any;
  assert.equal(Number(row.expected_amount), 500);
  await assert.rejects(
    db.exec(
      `select public.save_payment('${id}',2027,3,300,'2026-09-01',null,'')`,
    ),
    /INELIGIBLE/,
  );
  await assert.rejects(
    db.exec(
      `update public.members set leave_year=2027,leave_month=8,is_active=false where id='${id}'`,
    ),
    /HISTORY/,
  );
  for (let i = 0; i < 11; i++) {
    const res = (
      await db.query<{ allowed: boolean }>(
        `select public.admin_login_attempt('test-ip') as allowed`,
      )
    ).rows[0];
    assert.equal(res.allowed, i < 10);
  }
  assert.ok(
    (await db.query("select * from public.admin_logs")).rows.length >= 5,
  );
  const advanceMember='44444444-4444-4444-8444-444444444444';
  const batch='55555555-5555-4555-8555-555555555555';
  await db.exec(`insert into public.members(id,name,join_year,join_month) values('${advanceMember}','Advance',2098,1);insert into public.yearly_settings(year,monthly_amount) values(2098,300);select public.save_payment('${advanceMember}',2098,11,100,'2026-09-01',null,'');`);
  const entries=JSON.stringify([{year:2098,month:11,amount:200},{year:2098,month:12,amount:300},{year:2099,month:1,amount:700},{year:2099,month:2,amount:700}]);
  for(let i=0;i<2;i++)await db.query('select public.save_advance($1,$2,$3::jsonb,$4,$5,$6)',[batch,advanceMember,entries,'2026-09-01','shared-proof.webp','Advance']);
  const advancePayments=(await db.query<any>('select * from public.payments where member_id=$1 order by year,month',[advanceMember])).rows;
  assert.deepEqual(advancePayments.map(p=>Number(p.amount_paid)),[300,300,700,700]);
  assert.deepEqual(advancePayments.map(p=>Number(p.expected_amount)),[300,300,700,700]);
  assert.equal((await db.query('select * from public.admin_payment_batches')).rows.length,1);
  const failureEntries=JSON.stringify([{year:2098,month:3,amount:300},{year:2097,month:1,amount:300}]);
  await assert.rejects(db.query('select public.save_advance($1,$2,$3::jsonb,$4,$5,$6)',['66666666-6666-4666-8666-666666666666',advanceMember,failureEntries,'2026-09-01',null,'invalid']),/INELIGIBLE/);
  assert.equal((await db.query('select * from public.payments where member_id=$1 and month=3',[advanceMember])).rows.length,0);
  assert.equal((await db.query('select * from public.admin_payment_batches')).rows.length,1);
  const incomeId = '33333333-3333-4333-8333-333333333333';
  await db.exec(`insert into public.additional_income(id,year,month,kind,source,amount,entry_date) values('${incomeId}',2027,1,'opening_balance','Old balance',10000,'2027-01-01');update public.additional_income set amount=12000 where id='${incomeId}';`);
  assert.equal((await db.query("select * from public.admin_logs where action like 'additional_income:%'")).rows.length,2);
  await assert.rejects(db.exec(`insert into public.additional_income(year,month,kind,source,amount,entry_date) values(2027,1,'donation','Invalid',-1,'2027-01-01')`),/check constraint/);
  await db.exec(`reset role;set role anon`);
  assert.equal((await db.query("select * from public.members")).rows.length, 2);
  await assert.rejects(
    db.exec(`update public.members set name='Hacked'`),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("select * from public.admin_logs"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(`select public.admin_login_attempt('anon')`),
    /permission denied/,
  );
  assert.equal((await db.query('select * from public.additional_income')).rows.length,1);
  await assert.rejects(db.exec("update public.additional_income set amount=1"),/permission denied/);
  await assert.rejects(db.exec("delete from public.additional_income"),/permission denied/);
  await assert.rejects(db.exec("insert into public.additional_income(year,month,kind,source,amount,entry_date) values(2027,1,'donation','Public',100,'2027-01-01')"),/permission denied/);
  await db.exec(`reset role;set role service_role;delete from public.additional_income where id='${incomeId}';`);
  assert.equal((await db.query("select * from public.admin_logs where action='additional_income:DELETE'")).rows.length,1);
  assert.equal((await db.query('select * from public.additional_income')).rows.length,0);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.exec('select * from public.admin_payment_batches'),/permission denied/);
  await assert.rejects(db.query('select public.save_advance($1,$2,$3::jsonb,$4,$5,$6)',['77777777-7777-4777-8777-777777777777',advanceMember,entries,'2026-09-01',null,'public']),/permission denied/);
  await db.close();
});
