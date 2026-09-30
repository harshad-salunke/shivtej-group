import { clientId } from "@/lib/client-id";
import { useState } from "react";
import { type Data, type Member, months, money, num, today } from "@/lib/model";
import { advanceRows } from "@/lib/advance";
export default function AdvanceForm({
  data,
  member,
  year,
  month,
  busy,
  error,
  onSave,
  onClose,
}: {
  data: Data;
  member: Member;
  year: number;
  month: number;
  busy: boolean;
  error: string;
  onSave: (payload: any, file?: File) => Promise<void>;
  onClose: () => void;
}) {
  const [start, setStart] = useState(
      `${year}-${String(month).padStart(2, "0")}`,
    ),
    [count, setCount] = useState(4),
    [amounts, setAmounts] = useState<Record<string, number>>({}),
    [requestId] = useState(() => clientId());
  const [y, m] = start.split("-").map(Number);
  const rows = advanceRows(data, member, y || year, m || month, count);
  const values = rows
    .filter((r) => r.eligible)
    .map((r) => ({
      ...r,
      amount: amounts[`${r.year}-${r.month}`] ?? r.amount,
    }));
  const total =
    values.reduce((a, r) => a + Math.round(r.amount * 100), 0) / 100;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const file = f.get("proof") as File;
        await onSave(
          {
            request_id: requestId,
            member_id: member.id,
            entries: values
              .filter((r) => r.amount > 0)
              .map((r) => ({ year: r.year, month: r.month, amount: r.amount })),
            payment_date: f.get("date"),
            note: f.get("note"),
          },
          file?.size ? file : undefined,
        );
      }}
    >
      <div className="form-body">
        <p className="muted">
          {member.name} — एका वेळी पुढील महिन्यांची वर्गणी नोंदवा.
        </p>
        <div className="form-grid">
          <label className="field">
            <span>सुरुवातीचा महिना</span>
            <input
              type="month"
              value={start}
              min="2000-01"
              max="2100-12"
              required
              onChange={(e) => {
                setStart(e.target.value);
                setAmounts({});
              }}
            />
          </label>
          <label className="field">
            <span>किती महिने?</span>
            <select
              value={count}
              onChange={(e) => {
                setCount(+e.target.value);
                setAmounts({});
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option value={i + 1} key={i}>
                  {num(i + 1)} महिने
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="advance-rows">
          <div className="advance-row advance-head">
            <span>महिना / आधी जमा</span>
            <span>आता जमा (₹)</span>
          </div>
          {rows.map((r) => (
            <div className="advance-row" key={r.year + "-" + r.month}>
              <div>
                <strong>
                  {months[r.month - 1]} {num(r.year)}
                </strong>
                <small>
                  आधी {money(r.paid)} • अपेक्षित {money(r.expected)}
                </small>
                {!r.eligible && (
                  <small className="red-text">
                    सदस्यत्व या महिन्यात लागू नाही
                  </small>
                )}
              </div>
              <input
                aria-label={`${months[r.month - 1]} ${num(r.year)} आता जमा`}
                type="number"
                required
                min="0"
                max="1000000"
                step="0.01"
                disabled={!r.eligible}
                value={
                  r.eligible ? (amounts[`${r.year}-${r.month}`] ?? r.amount) : 0
                }
                onChange={(e) =>
                  setAmounts({
                    ...amounts,
                    [`${r.year}-${r.month}`]: Number(e.target.value),
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="advance-total">
          <span>आता मिळालेली एकूण रक्कम</span>
          <strong>{money(total)}</strong>
        </div>
        <label className="field">
          <span>वर्गणी मिळाल्याचा दिनांक</span>
          <input
            name="date"
            type="date"
            max={today()}
            defaultValue={today()}
            required
          />
        </label>
        <label className="field">
          <span>एकत्रित व्यवहाराची पावती (ऐच्छिक)</span>
          <input
            name="proof"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
        </label>
        <p className="privacy-note">
          एकाच व्यवहाराची पावती सर्व निवडलेल्या महिन्यांना जोडली जाईल. वैयक्तिक
          UPI / बँक माहिती आधी crop किंवा blur करा.
        </p>
        <label className="field">
          <span>टीप (ऐच्छिक)</span>
          <textarea
            name="note"
            maxLength={500}
            defaultValue="आगाऊ वर्गणी — एकत्रित व्यवहार"
          />
        </label>
        <p className="muted">
          प्रत्येक रक्कम त्या महिन्याच्या आधीच्या जमेत जोडली जाईल. 0 असलेले
          महिने बदलणार नाहीत.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>
          रद्द करा
        </button>
        <button
          className="primary"
          disabled={busy || total <= 0 || !Number.isFinite(total)}
        >
          {busy ? "जतन करत आहे…" : "सर्व नोंदी जतन करा"}
        </button>
      </div>
    </form>
  );
}
