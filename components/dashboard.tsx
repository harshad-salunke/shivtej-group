"use client";
import { clientId } from "@/lib/client-id";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Flag,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Users,
  Wallet,
  Clock,
  Check,
  Search,
  ChevronDown,
  Plus,
  Receipt,
  ShieldCheck,
  LogOut,
  Settings,
  Download,
  X,
  Volume2,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Megaphone,
  Eye,
  Trash2,
  LockKeyhole,
} from "lucide-react";
import {
  type Data,
  type Member,
  type Payment,
  type Notice,
  months,
  shortMonths,
  num,
  money,
  current,
  today,
  monthRows,
  summary,
  previousDues,
  memberYear,
  sampleData,
  rate,
  fundSummary,
} from "@/lib/model";
import Splash from "@/components/splash";
import ShareCard from "@/components/share-card";
import AdvanceForm from "@/components/advance-form";
import { LOGO_SRC } from "@/lib/brand";
import { advanceSchema } from "@/lib/advance";
import { eligible, record } from "@/lib/model";
import IncomeBreakdown from "@/components/income-breakdown";
import { incomeSchema, incomeKinds, type Income } from "@/lib/income";
const statusNames: Record<string, string> = {
  paid: "भरले",
  partial: "अंशतः भरले",
  unpaid: "बाकी",
};
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" onClick={close} aria-label="बंद करा">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function exportCSV(d: Data) {
  const lines = [
    [
      "सदस्य / स्रोत",
      "वर्ष",
      "महिना",
      "अपेक्षित रक्कम",
      "भरलेली रक्कम",
      "दिनांक",
      "स्थिती",
      "नोंदीचा प्रकार",
      "टीप",
    ],
  ];
  const now = current();
  for (const m of d.members) {
    for (
      let y = m.join_year;
      y <= Math.max(now.year, ...d.payments.map((p) => p.year));
      y++
    ) {
      for (let mo = 1; mo <= 12; mo++) {
        if (
          (y > now.year || (y === now.year && mo > now.month)) &&
          !d.payments.some(
            (p) => p.member_id === m.id && p.year === y && p.month === mo,
          )
        )
          continue;
        const r = monthRows(d, y, mo).find((r) => r.member.id === m.id);
        if (r)
          lines.push([
            m.name,
            String(y),
            String(mo),
            String(r.expected),
            String(r.paid),
            r.p?.payment_date ?? "",
            statusNames[r.status],
            "सदस्य वर्गणी",
            r.p?.note ?? "",
          ]);
      }
    }
  }
  for (const e of d.additional_income ?? [])
    lines.push([
      e.source,
      String(e.year),
      String(e.month),
      "",
      String(e.amount),
      e.entry_date,
      "जमा",
      incomeKinds[e.kind],
      e.note,
    ]);
  const csv = lines
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            (/^[=+@\-\t\r]/.test(v) ? "'" : "") +
            v.replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "shivtej-vargani.csv";
  a.click();
  URL.revokeObjectURL(url);
}
async function compress(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("JPG, PNG किंवा WebP चित्र निवडा.");
  if (file.size > 15 * 1024 * 1024)
    throw Error("मूळ चित्र १५ MB पेक्षा लहान असावे.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    blob = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.size < 800 * 1024) break;
  }
  if (!blob || blob.size > 2 * 1024 * 1024)
    throw Error("चित्र २ MB पेक्षा लहान करता आले नाही. कृपया crop करा.");
  return new File([blob], "receipt.webp", { type: "image/webp" });
}
export default function Dashboard({
  admin,
  offline = false,
}: {
  admin: boolean;
  offline?: boolean;
}) {
  const now = current();
  const [year, setYear] = useState(now.year),
    [month, setMonth] = useState(now.month),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [tab, setTab] = useState("payments"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [dueOpen, setDueOpen] = useState(false),
    [modal, setModal] = useState<
      | null
      | "payment"
      | "receipt"
      | "member"
      | "notice"
      | "settings"
      | "income"
      | "breakdown"
      | "advance"
    >(null),
    [selected, setSelected] = useState<Member | null>(null),
    [receipt, setReceipt] = useState<Payment | null>(null),
    [editNotice, setEditNotice] = useState<Notice | null>(null),
    [formError, setFormError] = useState("");
  const [editIncome, setEditIncome] = useState<Income | null>(null);
  const [breakdownPeriod, setBreakdownPeriod] = useState<{
    year: number;
    month?: number;
  }>({ year: now.year, month: now.month });
  function showBreakdown(y = year, m: number | undefined = month) {
    setBreakdownPeriod({ year: y, month: m });
    open("breakdown");
  }
  function startIncome(entry: Income | null = null) {
    setEditIncome(entry);
    open("income");
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = offline
        ? null
        : await fetch("/api/data", {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          });
      const d = offline ? sampleData() : await r!.json();
      if (r && !r.ok) throw Error(d.error);
      if (d.demo) {
        const saved = localStorage.getItem("shivtej-demo-v1");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.demo)
              ((d.members = parsed.members),
                (d.payments = parsed.payments),
                (d.notices = parsed.notices),
                (d.advance_batches = parsed.advance_batches ?? []),
                (d.settings = parsed.settings),
                (d.additional_income =
                  parsed.additional_income ?? d.additional_income ?? []));
          } catch {}
        }
      }
      d.advance_batches ??= [];
      setData(d);
      if (admin && !offline) {
        const s = await fetch("/api/session");
        setAuth((await s.json()).authenticated);
      }
    } catch {
      setError(
        "माहिती सध्या उपलब्ध नाही. कृपया काही वेळाने पुन्हा प्रयत्न करा.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    document
      .querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [month, loading]);
  const d = data;
  const sum = d ? summary(d, year, month) : null;
  const dues = d ? previousDues(d, year, month) : [];
  const yearly = d ? fundSummary(d, year).total : 0;
  const activeNotices =
    d?.notices.filter(
      (n) =>
        n.is_active &&
        (!n.start_date || n.start_date <= today()) &&
        (!n.end_date || n.end_date >= today()),
    ) ?? [];
  function open(type: typeof modal, m: Member | null = null) {
    setSelected(m);
    setFormError("");
    setModal(type);
  }
  function demoSave(next: Data) {
    localStorage.setItem("shivtej-demo-v1", JSON.stringify(next));
    setData(next);
  }
  async function mutate(entity: string, payload: any, file?: File) {
    if (!d) return;
    setBusy(true);
    setFormError("");
    try {
      if (d.demo) {
        const next = structuredClone(d);
        if (entity === "advance") {
          next.advance_batches ??= [];
          if (!next.advance_batches.includes(payload.request_id)) {
            if (
              payload.entries.some(
                (e: any) =>
                  !eligible(
                    next.members.find((m) => m.id === payload.member_id)!,
                    e.year,
                    e.month,
                  ),
              )
            )
              throw Error("या कालावधीतील सर्व महिन्यांत सदस्यत्व लागू नाही.");
            let path: string | null = null;
            if (file)
              path = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            for (const e of payload.entries) {
              const idx = next.payments.findIndex(
                (p) =>
                  p.member_id === payload.member_id &&
                  p.year === e.year &&
                  p.month === e.month,
              );
              const old = next.payments[idx];
              const p = {
                id: old?.id ?? clientId(),
                member_id: payload.member_id,
                year: e.year,
                month: e.month,
                expected_amount: old?.expected_amount ?? rate(next, e.year),
                amount_paid:
                  Math.round(((old?.amount_paid ?? 0) + e.amount) * 100) / 100,
                payment_date: payload.payment_date,
                screenshot_path: path ?? old?.screenshot_path ?? null,
                note: payload.note,
              };
              if (idx >= 0) next.payments[idx] = p;
              else next.payments.push(p);
            }
            next.advance_batches.push(payload.request_id);
          }
        } else if (entity === "income") {
          next.additional_income ??= [];
          if (payload.delete)
            next.additional_income = next.additional_income.filter(
              (e) => e.id !== payload.id,
            );
          else {
            const valid = incomeSchema.parse(payload);
            const entry = { ...valid, id: valid.id ?? clientId() };
            const idx = next.additional_income.findIndex(
              (e) => e.id === entry.id,
            );
            if (idx >= 0) next.additional_income[idx] = entry;
            else next.additional_income.push(entry);
          }
        } else if (entity === "payments") {
          const idx = next.payments.findIndex(
            (p) =>
              p.member_id === payload.member_id &&
              p.year === payload.year &&
              p.month === payload.month,
          );
          const old = next.payments[idx];
          let path = payload.remove_screenshot
            ? null
            : (old?.screenshot_path ?? null);
          if (file)
            path = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.onerror = rej;
              r.readAsDataURL(file);
            });
          const p = {
            ...payload,
            id: old?.id ?? clientId(),
            expected_amount: old?.expected_amount ?? rate(next, payload.year),
            screenshot_path: path,
          };
          if (idx >= 0) next.payments[idx] = p;
          else next.payments.push(p);
        } else if (entity === "members") {
          const idx = next.members.findIndex((m) => m.id === payload.id);
          if (idx >= 0)
            next.members[idx] = { ...next.members[idx], ...payload };
          else next.members.push({ ...payload, id: clientId() });
        } else if (entity === "notices") {
          if (payload.delete)
            next.notices = next.notices.filter((n) => n.id !== payload.id);
          else {
            const idx = next.notices.findIndex((n) => n.id === payload.id);
            if (idx >= 0) next.notices[idx] = payload;
            else next.notices.push({ ...payload, id: clientId() });
          }
        } else if (entity === "settings") {
          next.settings = next.settings
            .filter((s) => s.year !== payload.year)
            .concat(payload);
        }
        demoSave(next);
      } else {
        const body = new FormData();
        body.set("payload", JSON.stringify(payload));
        if (file) body.set("file", file);
        const r = await fetch("/api/admin/" + entity, { method: "POST", body });
        const result = await r.json();
        if (!r.ok) throw Error(result.error ?? "जतन करता आले नाही.");
        await load();
      }
      setModal(null);
      setToast("माहिती जतन केली.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "जतन करता आले नाही.");
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (offline) {
      setFormError("हा नमुना मोड आहे. खालील नमुना डॅशबोर्ड बटण वापरा.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setAuth(true);
      setPassword("");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function moveMonth(offset: number) {
    const date = new Date(year, month - 1 + offset, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }
  const years = Array.from(
    {
      length:
        Math.max(
          now.year + 3,
          year + 1,
          2029,
          ...(d?.additional_income?.map((e) => e.year) ?? []),
        ) -
        Math.min(
          2027,
          now.year,
          year,
          ...(d?.members.map((m) => m.join_year) ?? []),
          ...(d?.additional_income?.map((e) => e.year) ?? []),
        ) +
        1,
    },
    (_, i) =>
      Math.min(
        2027,
        now.year,
        year,
        ...(d?.members.map((m) => m.join_year) ?? []),
        ...(d?.additional_income?.map((e) => e.year) ?? []),
      ) + i,
  );
  const currentPayment = d?.payments.find(
    (p) => p.member_id === selected?.id && p.year === year && p.month === month,
  );
  return (
    <>
      <Splash />
      <header className="header">
        <div className="header-inner">
          <a href={offline ? "?" : "/"} className="brand">
            <span className="brand-icon">
              <img src={LOGO_SRC} alt="शिवतेज लोगो" />
            </span>
            <span>
              <strong>
                शिवतेज ग्रुप <span>वाखारी</span>
              </strong>
              <small>एकत्रित प्रयत्न. एकच ध्येय.</small>
            </span>
          </a>
          <div className="header-right">
            <span className="project-pill">
              <Volume2 size={15} /> साऊंड सिस्टीम • नियोजन २०२७
            </span>
            {admin ? (
              <a className="text-link" href={offline ? "?" : "/"}>
                सार्वजनिक पृष्ठ <ArrowUpRight size={15} />
              </a>
            ) : (
              <a className="admin-link" href={offline ? "?admin=1" : "/admin"}>
                <ShieldCheck size={17} />
                <span>व्यवस्थापक प्रवेश</span>
              </a>
            )}
          </div>
        </div>
      </header>
      {loading && !d ? (
        <main className="container">
          <div className="loading">माहिती लोड होत आहे…</div>
          <div className="skeleton-grid">
            {[1, 2, 3].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        </main>
      ) : error ? (
        <main className="container empty">
          <AlertCircle />
          <h2>माहिती सध्या उपलब्ध नाही</h2>
          <p>{error}</p>
          <button className="primary" onClick={load}>
            पुन्हा प्रयत्न करा
          </button>
        </main>
      ) : d && sum ? (
        <>
          {d.demo && (
            <div className="demo-bar">
              नमुना पूर्वावलोकन — नावे व रक्कम उदाहरणासाठी आहेत.{" "}
              {admin
                ? "बदल फक्त या ब्राउझरमध्ये जतन होतील."
                : "खरी वर्गणी माहिती अद्याप जोडलेली नाही."}
            </div>
          )}
          {admin && !auth ? (
            <main className="login-wrap">
              <section className="login-card">
                <div className="login-icon">
                  <LockKeyhole size={27} />
                </div>
                <span className="eyebrow">शिवतेज ग्रुप वाखारी</span>
                <h1>व्यवस्थापक प्रवेश</h1>
                <p>वर्गणी आणि सदस्यांची माहिती व्यवस्थापित करा.</p>
                <form onSubmit={login}>
                  <Field label="पासवर्ड टाका">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </Field>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <button className="primary full" disabled={busy}>
                    {busy ? "तपासत आहे…" : "प्रवेश करा"}{" "}
                    <ArrowRight size={17} />
                  </button>
                </form>
                {d.demo && (
                  <button
                    className="secondary full"
                    onClick={() => setAuth(true)}
                  >
                    नमुना डॅशबोर्ड पाहा
                  </button>
                )}
                <a href={offline ? "?" : "/"}>← सार्वजनिक वर्गणी यादी</a>
              </section>
            </main>
          ) : (
            <main className="container">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {admin ? "व्यवस्थापन" : "आपली वर्गणी • आपला हिशोब"}
                  </span>
                  <h1>{admin ? "व्यवस्थापक डॅशबोर्ड" : "वर्गणी आढावा"}</h1>
                  <p>साऊंड सिस्टीमसाठी प्रत्येकाचे योगदान, एका ठिकाणी.</p>
                </div>
                <div className="heading-actions">
                  {admin && (
                    <>
                      <button
                        className="icon"
                        title="सेटिंग्ज"
                        aria-label="सेटिंग्ज"
                        onClick={() => open("settings")}
                      >
                        <Settings size={20} />
                      </button>
                      <button
                        className="icon"
                        title="CSV Export"
                        aria-label="डेटा Export करा"
                        onClick={() => exportCSV(d)}
                      >
                        <Download size={20} />
                      </button>
                      <button
                        className="icon"
                        aria-label="बाहेर पडा"
                        onClick={async () => {
                          if (!d.demo)
                            await fetch("/api/session", { method: "DELETE" });
                          setAuth(false);
                        }}
                      >
                        <LogOut size={20} />
                      </button>
                    </>
                  )}
                  <label className="year-select">
                    <CalendarDays size={17} />
                    <select
                      aria-label="वर्ष निवडा"
                      value={year}
                      onChange={(e) => setYear(+e.target.value)}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {num(y)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>
              </div>
              <div className="stats">
                <button
                  className="stat stat-primary total-card"
                  onClick={() => showBreakdown()}
                  aria-label="या महिन्याच्या एकूण निधीचा तपशील"
                >
                  <div className="stat-label">
                    <span>या महिन्याचा एकूण निधी</span>
                    <span className="stat-icon">
                      <Wallet size={20} />
                    </span>
                  </div>
                  <strong>{money(sum.total)}</strong>
                  <div className="stat-foot">
                    <span>
                      {months[month - 1]} {num(year)}
                    </span>
                    <span>
                      तपशील पहा <ArrowUpRight size={14} />
                    </span>
                  </div>
                </button>
                <div className="stat">
                  <div className="stat-label">
                    <span>या महिन्यात बाकी</span>
                    <span className="stat-icon amber">
                      <Clock size={20} />
                    </span>
                  </div>
                  <strong>{money(sum.due)}</strong>
                  <div className="stat-foot">
                    <span>
                      {num(sum.partial + sum.unpaid)} सदस्यांची वर्गणी बाकी
                    </span>
                    <span className="muted">
                      अपेक्षित {money(sum.expected)}
                    </span>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">
                    <span>वर्षातील एकूण निधी</span>
                    <span className="stat-icon green">
                      <Users size={20} />
                    </span>
                  </div>
                  <button
                    className="annual-total-button"
                    onClick={() => {
                      setBreakdownPeriod({ year });
                      open("breakdown");
                    }}
                    aria-label="वर्षातील एकूण निधीचा तपशील"
                  >
                    {money(yearly)} <ArrowUpRight size={17} />
                  </button>
                  <div className="stat-foot">
                    <span>{num(year)} • वर्गणी, इतर जमा व शिल्लक</span>
                    <span className="green-text">एकत्र पुढे जाऊया</span>
                  </div>
                </div>
              </div>
              <div className="notice-strip">
                <span className="notice-icon">
                  <Megaphone size={18} />
                </span>
                <strong>सूचना</strong>
                <p>
                  {activeNotices[0]?.message ??
                    "सर्व सदस्यांच्या सहकार्याबद्दल धन्यवाद."}
                </p>
                {activeNotices.length > 1 && (
                  <button onClick={() => setTab("notices")}>
                    +{num(activeNotices.length - 1)} आणखी
                  </button>
                )}
              </div>
              <nav className="main-tabs" aria-label="मुख्य विभाग">
                {[
                  ["payments", "मासिक वर्गणी"],
                  ["members", "सदस्यनिहाय हिशोब"],
                  ["year", "वार्षिक आढावा"],
                  ...(admin || activeNotices.length > 1
                    ? [["notices", "सूचना"]]
                    : []),
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    {label}
                    {id === "payments" && <span>{num(sum.rows.length)}</span>}
                  </button>
                ))}
              </nav>
              {tab === "payments" && (
                <>
                  <section className="month-section">
                    <div className="section-heading">
                      <h2>
                        {months[month - 1]} <span>{num(year)}</span>
                      </h2>
                      <div className="month-controls">
                        <button
                          className="icon"
                          onClick={() => moveMonth(-1)}
                          aria-label="मागील महिना"
                        >
                          <ArrowLeft size={17} />
                        </button>
                        <button
                          className="today-btn"
                          onClick={() => {
                            setYear(now.year);
                            setMonth(now.month);
                          }}
                        >
                          चालू महिना
                        </button>
                        <button
                          className="icon"
                          onClick={() => moveMonth(1)}
                          aria-label="पुढील महिना"
                        >
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </div>
                    <div className="month-slider">
                      {shortMonths.map((m, i) => (
                        <button
                          key={m}
                          data-selected={month === i + 1}
                          className={month === i + 1 ? "selected" : ""}
                          onClick={() => setMonth(i + 1)}
                        >
                          {m}
                          <span
                            className={
                              d.payments.some(
                                (p) =>
                                  p.year === year &&
                                  p.month === i + 1 &&
                                  p.amount_paid > 0,
                              )
                                ? "has-payments"
                                : ""
                            }
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                  {dues.length > 0 && (
                    <section className="dues-alert">
                      <button
                        className="dues-trigger"
                        onClick={() => setDueOpen(!dueOpen)}
                        aria-expanded={dueOpen}
                      >
                        <AlertCircle size={20} />
                        <div>
                          <strong>मागील वर्गणी बाकी</strong>
                          <span>
                            {num(dues.length)} सदस्यांची एकूण{" "}
                            {money(dues.reduce((a, r) => a + r.total, 0))}{" "}
                            वर्गणी बाकी आहे.
                          </span>
                        </div>
                        <span className="details-label">
                          तपशील {dueOpen ? "लपवा" : "पहा"}
                        </span>
                        <ChevronDown size={18} />
                      </button>
                      {dueOpen && (
                        <div className="dues-grid">
                          {dues.map((r) => (
                            <div key={r.member.id}>
                              <strong>
                                {r.member.name} <span>{money(r.total)}</span>
                              </strong>
                              {r.entries.map((e) => (
                                <p key={e.year + "-" + e.month}>
                                  {months[e.month - 1]} {num(e.year)}{" "}
                                  <span>{money(e.due)}</span>
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  <section className="additional-income-strip">
                    <div>
                      <span>
                        सदस्य वर्गणी <strong>{money(sum.paid)}</strong>
                      </span>
                      <span>
                        इतर जमा व शिल्लक <strong>{money(sum.extra)}</strong>
                      </span>
                    </div>
                    <div>
                      <button
                        className="text-link"
                        onClick={() => showBreakdown()}
                      >
                        तपशील पहा <ArrowUpRight size={16} />
                      </button>
                      {admin && (
                        <button
                          className="primary"
                          onClick={() => startIncome()}
                        >
                          <Plus size={17} /> इतर जमा जोडा
                        </button>
                      )}
                    </div>
                  </section>
                  {sum.rows.length > 0 && sum.paid === 0 && (
                    <p className="month-empty">
                      अजून सदस्यांची कोणतीही वर्गणी नोंदवलेली नाही.
                    </p>
                  )}
                  <div className="content-grid">
                    <section className="ledger">
                      <div className="ledger-tools">
                        <div className="search">
                          <Search size={17} />
                          <input
                            aria-label="सदस्य शोधा"
                            placeholder="सदस्य शोधा…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </div>
                        <div className="filters">
                          {[
                            ["all", "सर्व"],
                            ["paid", "भरले"],
                            ["partial", "अंशतः"],
                            ["unpaid", "बाकी"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              className={filter === id ? "active" : ""}
                              onClick={() => setFilter(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="table-header">
                        <span>सदस्य</span>
                        <span>स्थिती</span>
                        <span>जमा रक्कम</span>
                        <span>{admin ? "नोंद" : "पावती"}</span>
                      </div>
                      <div className="member-list">
                        {sum.rows
                          .filter(
                            (r) =>
                              r.member.name.includes(query) &&
                              (filter === "all" || r.status === filter),
                          )
                          .map((r, i) => (
                            <div className="member-row" key={r.member.id}>
                              <div className="member-name">
                                <span className={"avatar avatar-" + (i % 4)}>
                                  {r.member.name
                                    .split(" ")
                                    .map((x) => x[0])
                                    .slice(0, 2)
                                    .join("")}
                                </span>
                                <div>
                                  <strong>{r.member.name}</strong>
                                  <small>
                                    {r.p?.payment_date
                                      ? new Date(
                                          r.p.payment_date + "T12:00:00",
                                        ).toLocaleDateString("mr-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : "वर्गणीची प्रतीक्षा"}
                                  </small>
                                </div>
                              </div>
                              <span className={"badge " + r.status}>
                                {r.status === "paid" ? (
                                  <CheckCircle2 size={14} />
                                ) : r.status === "partial" ? (
                                  <Clock size={14} />
                                ) : (
                                  <span className="dot" />
                                )}
                                {statusNames[r.status]}
                              </span>
                              <div className="amount">
                                <strong>{money(r.paid)}</strong>
                                {r.due > 0 && (
                                  <small>{money(r.due)} बाकी</small>
                                )}
                                {r.paid > r.expected && (
                                  <small className="green-text">
                                    {money(r.paid - r.expected)} अधिक
                                  </small>
                                )}
                              </div>
                              {admin ? (
                                <button
                                  className={
                                    "row-action " +
                                    (!r.paid ? "add-payment" : "")
                                  }
                                  onClick={() => open("payment", r.member)}
                                >
                                  {r.paid ? (
                                    <Pencil size={16} />
                                  ) : (
                                    <Plus size={16} />
                                  )}
                                  <span>{r.paid ? "बदला" : "भरले"}</span>
                                </button>
                              ) : r.p?.screenshot_path ? (
                                <button
                                  className="row-action"
                                  onClick={() => {
                                    setReceipt(r.p!);
                                    open("receipt", r.member);
                                  }}
                                >
                                  <Receipt size={16} />
                                  <span>पहा</span>
                                </button>
                              ) : (
                                <span className="no-receipt">—</span>
                              )}
                            </div>
                          ))}
                      </div>
                      {sum.rows.filter(
                        (r) =>
                          r.member.name.includes(query) &&
                          (filter === "all" || r.status === filter),
                      ).length === 0 && (
                        <div className="empty">
                          <Users size={30} />
                          <h3>
                            {sum.rows.length
                              ? "सदस्य सापडला नाही"
                              : "या महिन्यात सदस्य नोंदवलेले नाहीत"}
                          </h3>
                          <p>
                            {sum.rows.length
                              ? "शोध किंवा स्थितीचा पर्याय बदला."
                              : "व्यवस्थापक सदस्य जोडल्यावर येथे दिसतील."}
                          </p>
                        </div>
                      )}
                      <div className="ledger-footer">
                        <ShieldCheck size={15} /> सर्वांसाठी खुला आणि पारदर्शक
                        हिशोब <span>{num(sum.rows.length)} सदस्य</span>
                      </div>
                    </section>
                    <aside>
                      <section className="summary-card" id="monthly-summary">
                        <h3>
                          महिन्याचा सारांश <span>{shortMonths[month - 1]}</span>
                        </h3>
                        <div className="collection-label">
                          <span>जमा झालेली वर्गणी</span>
                          <strong>
                            {num(
                              sum.expected
                                ? Math.round(
                                    Math.min(sum.paid / sum.expected, 1) * 100,
                                  )
                                : 0,
                            )}
                            %
                          </strong>
                        </div>
                        <div className="progress-track">
                          <span
                            style={{
                              width:
                                Math.min(
                                  sum.expected
                                    ? (sum.paid / sum.expected) * 100
                                    : 0,
                                  100,
                                ) + "%",
                            }}
                          />
                        </div>
                        <div className="summary-lines">
                          <p>
                            <span>एकूण सदस्य</span>
                            <strong>{num(sum.rows.length)}</strong>
                          </p>
                          <p>
                            <span>अपेक्षित वर्गणी</span>
                            <strong>{money(sum.expected)}</strong>
                          </p>
                          <p>
                            <span>सदस्यांची जमा वर्गणी</span>
                            <strong className="green-text">
                              {money(sum.paid)}
                            </strong>
                          </p>
                          <p>
                            <span>इतर जमा व शिल्लक</span>
                            <strong>{money(sum.extra)}</strong>
                          </p>
                          <p>
                            <button
                              className="fund-summary-link"
                              onClick={() => showBreakdown()}
                            >
                              <span>
                                एकूण निधी <ArrowUpRight size={14} />
                              </span>
                              <strong>{money(sum.total)}</strong>
                            </button>
                          </p>
                          <p>
                            <span>एकूण बाकी</span>
                            <strong className="red-text">
                              {money(sum.due)}
                            </strong>
                          </p>
                        </div>
                        <div className="status-counts">
                          <div>
                            <i className="green-dot" />
                            <strong>{num(sum.full)}</strong>
                            <span>पूर्ण भरले</span>
                          </div>
                          <div>
                            <i className="amber-dot" />
                            <strong>{num(sum.partial)}</strong>
                            <span>अंशतः</span>
                          </div>
                          <div>
                            <i className="red-dot" />
                            <strong>{num(sum.unpaid)}</strong>
                            <span>बाकी</span>
                          </div>
                        </div>
                      </section>
                      <section className="contribution-card">
                        <div>
                          <Volume2 size={22} />
                          <span>आपले ध्येय</span>
                        </div>
                        <h3>
                          आपली साऊंड सिस्टीम.
                          <br />
                          आपल्या सर्वांचे योगदान.
                        </h3>
                        <p>दरमहा {money(rate(d, year))} वर्गणी</p>
                        <span className="small-muted">
                          शिवतेज ग्रुप वाखारी • नियोजन २०२७
                        </span>
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {tab === "members" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>
                      सदस्यनिहाय जमा <span>{num(year)}</span>
                    </h2>
                    {admin && (
                      <button
                        className="primary"
                        onClick={() => open("member")}
                      >
                        <Plus size={17} /> सदस्य जोडा
                      </button>
                    )}
                  </div>
                  <div className="search">
                    <Search size={18} />
                    <input
                      placeholder="सदस्य शोधा…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="सदस्य शोधा"
                    />
                  </div>
                  <div className="member-cards">
                    {d.members
                      .filter((m) => m.name.includes(query))
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((m) => {
                        const s = memberYear(d, m, year);
                        return (
                          <article className="member-card" key={m.id}>
                            <div>
                              <h3>{m.name}</h3>
                              {admin && (
                                <button
                                  className="icon"
                                  onClick={() => open("member", m)}
                                  aria-label={m.name + " बदला"}
                                >
                                  <Pencil size={17} />
                                </button>
                              )}
                            </div>
                            <small>
                              {months[m.join_month - 1]} {num(m.join_year)}{" "}
                              पासून{" "}
                              {m.leave_year
                                ? `• ${months[m.leave_month! - 1]} ${num(m.leave_year)} पर्यंत`
                                : ""}
                            </small>
                            <div className="member-metrics">
                              <p>
                                <span>पूर्ण भरलेले महिने</span>
                                <strong>
                                  {num(s.full)} / {num(s.count)}
                                </strong>
                              </p>
                              <p>
                                <span>वर्षातील जमा</span>
                                <strong className="green-text">
                                  {money(s.paid)}
                                </strong>
                              </p>
                              <p>
                                <span>चालू महिन्यापर्यंत बाकी</span>
                                <strong className={s.due ? "red-text" : ""}>
                                  {money(s.due)}
                                </strong>
                              </p>
                              <p>
                                <span>आतापर्यंत एकूण भरले</span>
                                <strong>
                                  {money(
                                    d.payments
                                      .filter((p) => p.member_id === m.id)
                                      .reduce((a, p) => a + p.amount_paid, 0),
                                  )}
                                </strong>
                              </p>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                  {!d.members.length && (
                    <div className="empty">अजून सदस्य नोंदवलेले नाहीत.</div>
                  )}
                </section>
              )}
              {tab === "year" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>{num(year)} वार्षिक आढावा</h2>
                    <button
                      className="year-total"
                      onClick={() => {
                        setBreakdownPeriod({ year });
                        open("breakdown");
                      }}
                      aria-label="वार्षिक निधीचा तपशील"
                    >
                      {money(yearly)} <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <p className="muted">
                    प्रत्येक महिन्याची वर्गणी + इतर जमा + त्या महिन्यात
                    नोंदवलेली मागील शिल्लक
                  </p>
                  <div className="annual-bars">
                    {months.map((m, i) => {
                      const total = fundSummary(d, year, i + 1).total;
                      return (
                        <button
                          key={m}
                          onClick={() => {
                            showBreakdown(year, i + 1);
                          }}
                        >
                          <span>{m}</span>
                          <div>
                            <i
                              style={{
                                width:
                                  Math.max(
                                    1,
                                    (total /
                                      Math.max(
                                        ...months.map(
                                          (_, j) =>
                                            fundSummary(d, year, j + 1).total,
                                        ),
                                        1,
                                      )) *
                                      100,
                                  ) + "%",
                              }}
                            />
                          </div>
                          <strong>{money(total)}</strong>
                          <ArrowUpRight size={16} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {tab === "notices" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>ग्रुपच्या सूचना</h2>
                    {admin && (
                      <button
                        className="primary"
                        onClick={() => {
                          setEditNotice(null);
                          open("notice");
                        }}
                      >
                        <Plus size={18} /> सूचना जोडा
                      </button>
                    )}
                  </div>
                  {(admin ? d.notices : activeNotices).map((n) => (
                    <article className="notice-card" key={n.id}>
                      <Megaphone size={22} />
                      <div>
                        <p>{n.message}</p>
                        <small>
                          {n.is_active ? "दाखवलेली सूचना" : "लपवलेली सूचना"}{" "}
                          {n.start_date ?? ""}{" "}
                          {n.end_date ? " — " + n.end_date : ""}
                        </small>
                      </div>
                      {admin && (
                        <button
                          className="icon"
                          aria-label="सूचना बदला"
                          onClick={() => {
                            setEditNotice(n);
                            open("notice");
                          }}
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                    </article>
                  ))}
                  {!d.notices.length && (
                    <div className="empty">सध्या कोणतीही सूचना नाही.</div>
                  )}
                </section>
              )}
              <ShareCard data={d} year={year} month={month} />
              <footer>
                <div>
                  <img className="footer-logo" src={LOGO_SRC} alt="" /> शिवतेज
                  ग्रुप वाखारी
                </div>
                <span>एकीची ताकद, प्रगतीची वाट.</span>
                <small>नियोजन २०२७</small>
              </footer>
              {tab === "payments" && (
                <button
                  className="bottom-summary"
                  onClick={() => showBreakdown()}
                >
                  <span>
                    {shortMonths[month - 1]} निधी{" "}
                    <strong>{money(sum.total)}</strong>
                  </span>
                  <span>
                    बाकी <strong>{money(sum.due)}</strong>{" "}
                    <ChevronDown size={16} />
                  </span>
                </button>
              )}
            </main>
          )}
          {modal === "breakdown" && (
            <Modal title="एकूण निधीचा तपशील" close={() => setModal(null)}>
              <IncomeBreakdown
                data={d}
                year={breakdownPeriod.year}
                month={breakdownPeriod.month}
                admin={admin && auth}
                onAdd={() => {
                  setYear(breakdownPeriod.year);
                  if (breakdownPeriod.month) setMonth(breakdownPeriod.month);
                  setEditIncome(null);
                  open("income");
                }}
                onEdit={startIncome}
              />
              {breakdownPeriod.month && (
                <div className="form-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setYear(breakdownPeriod.year);
                      setMonth(breakdownPeriod.month!);
                      setTab("payments");
                      setModal(null);
                    }}
                  >
                    या महिन्याची वर्गणी पाहा
                  </button>
                </div>
              )}
            </Modal>
          )}
          {modal === "income" && admin && auth && (
            <Modal
              title={
                editIncome ? "इतर जमा नोंद बदला" : "इतर जमा / मागील शिल्लक जोडा"
              }
              close={() => setModal(null)}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const [yy, mm] = String(f.get("period"))
                    .split("-")
                    .map(Number);
                  mutate("income", {
                    ...(editIncome ? { id: editIncome.id } : {}),
                    kind: f.get("kind"),
                    source: f.get("source"),
                    amount: Number(f.get("amount")),
                    year: yy,
                    month: mm,
                    entry_date: f.get("date"),
                    note: f.get("note"),
                  });
                }}
              >
                <div className="form-body">
                  <Field label="नोंदीचा प्रकार">
                    <select
                      name="kind"
                      defaultValue={editIncome?.kind ?? "donation"}
                    >
                      {Object.entries(incomeKinds).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="देणगीदाराचे नाव / शिल्लकीचे कारण">
                    <input
                      name="source"
                      required
                      maxLength={120}
                      placeholder="उदा. मागील वर्षाची शिल्लक किंवा देणगीदाराचे नाव"
                      defaultValue={editIncome?.source}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="रक्कम (₹)">
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                        defaultValue={editIncome?.amount}
                      />
                    </Field>
                    <Field label="कोणत्या महिन्यात जोडायची?">
                      <input
                        name="period"
                        type="month"
                        min="2000-01"
                        max="2100-12"
                        required
                        defaultValue={`${editIncome?.year ?? year}-${String(editIncome?.month ?? month).padStart(2, "0")}`}
                      />
                    </Field>
                  </div>
                  <Field label="नोंदीचा दिनांक">
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={editIncome?.entry_date ?? today()}
                    />
                  </Field>
                  <Field label="टीप (ऐच्छिक • सर्वांना दिसेल)">
                    <textarea
                      name="note"
                      maxLength={500}
                      defaultValue={editIncome?.note}
                    />
                  </Field>
                  <p className="privacy-note">
                    ही रक्कम निवडलेल्या महिन्याच्या एकूण निधीत जोडली जाईल. मागील
                    शिल्लक पुन्हा पुढील महिन्यांत नोंदवू नका. सदस्यांची बाकी
                    बदलणार नाही.
                  </p>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  {editIncome && (
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "ही अतिरिक्त जमा नोंद हटवायची का? एकूण निधी कमी होईल.",
                          )
                        )
                          mutate("income", { id: editIncome.id, delete: true });
                      }}
                    >
                      <Trash2 size={16} /> नोंद हटवा
                    </button>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    रद्द करा
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "जतन करत आहे…" : "जतन करा"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {modal === "advance" && selected && admin && auth && (
            <Modal
              title="अनेक महिन्यांची आगाऊ वर्गणी"
              close={() => setModal(null)}
            >
              <AdvanceForm
                data={d}
                member={selected}
                year={year}
                month={month}
                busy={busy}
                error={formError}
                onClose={() => setModal(null)}
                onSave={async (payload, file) => {
                  setBusy(true);
                  setFormError("");
                  try {
                    const validated = advanceSchema.safeParse({
                      ...payload,
                      member_id: d.demo
                        ? "11111111-1111-4111-8111-111111111111"
                        : payload.member_id,
                    });
                    if (!validated.success)
                      throw Error(
                        "रक्कम आणि दिनांक तपासा. किमान एका महिन्याची रक्कम भरावी.",
                      );
                    const compressed = file ? await compress(file) : undefined;
                    await mutate("advance", payload, compressed);
                  } catch (e) {
                    setFormError((e as Error).message);
                    setBusy(false);
                  }
                }}
              />
            </Modal>
          )}
          {modal === "payment" && selected && (
            <Modal
              title={selected.name + " • " + months[month - 1]}
              close={() => setModal(null)}
            >
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    setBusy(true);
                    const file = f.get("screenshot") as File;
                    const compressed = file?.size
                      ? await compress(file)
                      : undefined;
                    await mutate(
                      "payments",
                      {
                        member_id: selected.id,
                        year,
                        month,
                        amount_paid: Number(f.get("amount")),
                        payment_date:
                          Number(f.get("amount")) > 0 ? f.get("date") : null,
                        note: f.get("note"),
                        remove_screenshot: f.get("remove") === "on",
                      },
                      compressed,
                    );
                  } catch (e) {
                    setFormError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                <div className="form-body">
                  <p className="muted">
                    अपेक्षित वर्गणी:{" "}
                    {money(currentPayment?.expected_amount ?? rate(d, year))}
                  </p>
                  <button
                    type="button"
                    className="advance-launch secondary"
                    onClick={() => {
                      setFormError("");
                      setModal("advance");
                    }}
                  >
                    <CalendarDays size={18} /> अनेक महिन्यांची आगाऊ वर्गणी
                    नोंदवा
                  </button>
                  <div className="form-grid">
                    <Field label="भरलेली रक्कम (₹)">
                      <input
                        name="amount"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        required
                        defaultValue={
                          currentPayment?.amount_paid || rate(d, year)
                        }
                      />
                    </Field>
                    <Field label="वर्गणी भरल्याचा दिनांक">
                      <input
                        name="date"
                        type="date"
                        max={today()}
                        required
                        defaultValue={currentPayment?.payment_date ?? today()}
                      />
                    </Field>
                  </div>
                  <Field label="वर्गणीची पावती">
                    <input
                      name="screenshot"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                    />
                  </Field>
                  <p className="privacy-note">
                    <ShieldCheck size={17} /> पावती सर्वांना दिसेल. UPI ID,
                    मोबाइल क्रमांक व बँकेची माहिती आधी crop किंवा blur करा.
                  </p>
                  {currentPayment?.screenshot_path && (
                    <label className="checkbox">
                      <input type="checkbox" name="remove" /> जुनी पावती काढून
                      टाका
                    </label>
                  )}
                  <Field label="टीप (ऐच्छिक • सर्वांना दिसेल)">
                    <textarea
                      name="note"
                      maxLength={500}
                      defaultValue={currentPayment?.note}
                    />
                  </Field>
                  <p className="muted">
                    वर्गणी बाकी म्हणून नोंदवण्यासाठी रक्कम ० करा.
                  </p>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    रद्द करा
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "जतन करत आहे…" : "जतन करा"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {modal === "receipt" && receipt && selected && (
            <Modal title="वर्गणीची पावती" close={() => setModal(null)}>
              <div className="form-body receipt-view">
                <h3>{selected.name}</h3>
                <p>
                  {months[receipt.month - 1]} {num(receipt.year)} •{" "}
                  {money(receipt.amount_paid)}
                </p>
                <p className="muted">{receipt.payment_date}</p>
                {receipt.screenshot_path && (
                  <img
                    src={
                      receipt.screenshot_path.startsWith("data:")
                        ? receipt.screenshot_path
                        : d.storageUrl + "/" + receipt.screenshot_path
                    }
                    alt={selected.name + " यांच्या वर्गणीची पावती"}
                  />
                )}
                <p>{receipt.note}</p>
              </div>
            </Modal>
          )}
          {modal === "member" && (
            <Modal
              title={selected ? "सदस्याची माहिती बदला" : "नवीन सदस्य जोडा"}
              close={() => setModal(null)}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const [jy, jm] = String(f.get("join")).split("-").map(Number);
                  const leave = String(f.get("leave"));
                  const [ly, lm] = leave
                    ? leave.split("-").map(Number)
                    : [null, null];
                  if (ly && ly * 12 + lm! < jy * 12 + jm) {
                    setFormError("निष्क्रिय होण्याचा महिना प्रवेशानंतर असावा.");
                    return;
                  }
                  mutate("members", {
                    ...(selected ? { id: selected.id } : {}),
                    name: String(f.get("name")).trim(),
                    join_year: jy,
                    join_month: jm,
                    leave_year: ly,
                    leave_month: lm,
                    is_active: !leave,
                    display_order: Number(f.get("order")),
                  });
                }}
              >
                <div className="form-body">
                  <Field label="सदस्याचे नाव">
                    <input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={selected?.name}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="वर्गणी सुरू होण्याचा महिना">
                      <input
                        type="month"
                        name="join"
                        required
                        min="2000-01"
                        max="2100-12"
                        defaultValue={
                          selected
                            ? `${selected.join_year}-${String(selected.join_month).padStart(2, "0")}`
                            : `${Math.max(2027, now.year)}-01`
                        }
                      />
                    </Field>
                    <Field label="यादीतील क्रमांक">
                      <input
                        name="order"
                        type="number"
                        min="0"
                        max="9999"
                        required
                        defaultValue={
                          selected?.display_order ?? d.members.length + 1
                        }
                      />
                    </Field>
                  </div>
                  {selected && (
                    <Field label="शेवटचा वर्गणी महिना (निष्क्रिय करण्यासाठी)">
                      <input
                        type="month"
                        name="leave"
                        min="2000-01"
                        max="2100-12"
                        defaultValue={
                          selected.leave_year
                            ? `${selected.leave_year}-${String(selected.leave_month).padStart(2, "0")}`
                            : ""
                        }
                      />
                    </Field>
                  )}
                  <p className="muted">
                    शेवटच्या महिन्यापर्यंतचा हिशोब जतन राहील. त्यानंतर नवीन बाकी
                    लागणार नाही.
                  </p>
                  {formError && (
                    <p role="alert" className="form-error">
                      {formError}
                    </p>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    रद्द करा
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "जतन करत आहे…" : "जतन करा"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {modal === "notice" && (
            <Modal
              title={editNotice ? "सूचना बदला" : "नवीन सूचना"}
              close={() => setModal(null)}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  mutate("notices", {
                    ...(editNotice ? { id: editNotice.id } : {}),
                    message: f.get("message"),
                    start_date: f.get("start") || null,
                    end_date: f.get("end") || null,
                    is_active: f.get("active") === "on",
                  });
                }}
              >
                <div className="form-body">
                  <Field label="सूचनेचा मजकूर">
                    <textarea
                      name="message"
                      required
                      maxLength={1500}
                      rows={4}
                      defaultValue={editNotice?.message}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="पासून (ऐच्छिक)">
                      <input
                        type="date"
                        name="start"
                        defaultValue={editNotice?.start_date ?? ""}
                      />
                    </Field>
                    <Field label="पर्यंत (ऐच्छिक)">
                      <input
                        type="date"
                        name="end"
                        defaultValue={editNotice?.end_date ?? ""}
                      />
                    </Field>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={editNotice?.is_active ?? true}
                    />{" "}
                    सूचना सार्वजनिक पृष्ठावर दाखवा
                  </label>
                  {formError && (
                    <p role="alert" className="form-error">
                      {formError}
                    </p>
                  )}
                  {editNotice && (
                    <button
                      className="danger"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("ही सूचना कायमची हटवायची का?"))
                          mutate("notices", {
                            id: editNotice.id,
                            delete: true,
                          });
                      }}
                    >
                      <Trash2 size={16} /> सूचना हटवा
                    </button>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    रद्द करा
                  </button>
                  <button className="primary" disabled={busy}>
                    जतन करा
                  </button>
                </div>
              </form>
            </Modal>
          )}
          {modal === "settings" && (
            <Modal title="वर्गणी सेटिंग्ज" close={() => setModal(null)}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  mutate("settings", {
                    year: Number(f.get("year")),
                    monthly_amount: Number(f.get("amount")),
                  });
                }}
              >
                <div className="form-body">
                  <p className="muted">
                    नवीन दर पुढील वर्षापासून लागू करा. आधीच्या नोंदींमधील
                    अपेक्षित रक्कम बदलणार नाही.
                  </p>
                  <Field label="लागू होणारे वर्ष">
                    <input
                      name="year"
                      type="number"
                      min={now.year + 1}
                      max="2100"
                      defaultValue={Math.max(2027, now.year + 1)}
                      required
                    />
                  </Field>
                  <Field label="मासिक वर्गणी (₹)">
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      max="1000000"
                      step="0.01"
                      defaultValue="300"
                      required
                    />
                  </Field>
                  <div className="summary-lines">
                    {d.settings.map((s) => (
                      <p key={s.year}>
                        <span>{num(s.year)} पासून</span>
                        <strong>{money(s.monthly_amount)}</strong>
                      </p>
                    ))}
                  </div>
                  {formError && (
                    <p role="alert" className="form-error">
                      {formError}
                    </p>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    रद्द करा
                  </button>
                  <button className="primary" disabled={busy}>
                    जतन करा
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </>
      ) : null}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
