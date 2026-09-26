import {
  type Data,
  fundSummary,
  monthRows,
  eligible,
  months,
  money,
  num,
} from "@/lib/model";
import { type Income, incomeKinds } from "@/lib/income";
import { Plus, Pencil, Wallet } from "lucide-react";
export default function IncomeBreakdown({
  data,
  year,
  month,
  admin,
  onAdd,
  onEdit,
}: {
  data: Data;
  year: number;
  month?: number;
  admin: boolean;
  onAdd: () => void;
  onEdit: (entry: Income) => void;
}) {
  const f = fundSummary(data, year, month);
  const members = month
    ? monthRows(data, year, month).map((r) => ({
        id: r.member.id,
        name: r.member.name,
        paid: r.paid,
      }))
    : data.members
        .filter((m) =>
          Array.from({ length: 12 }, (_, i) => i + 1).some((mo) =>
            eligible(m, year, mo),
          ),
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          paid: data.payments
            .filter((p) => p.member_id === m.id && p.year === year)
            .reduce((a, p) => a + p.amount_paid, 0),
        }));
  return (
    <div className="form-body fund-breakdown">
      <div className="fund-total">
        <Wallet size={22} />
        <div>
          <span>
            {month ? months[month - 1] + " " : ""}
            {num(year)} • एकूण निधी
          </span>
          <strong>{money(f.total)}</strong>
        </div>
      </div>
      <div className="summary-lines">
        <p>
          <span>सदस्यांची वर्गणी</span>
          <strong>{money(f.memberPaid)}</strong>
        </p>
        <p>
          <span>देणगी / इतर जमा</span>
          <strong>{money(f.donations)}</strong>
        </p>
        <p>
          <span>मागील शिल्लक</span>
          <strong>{money(f.openingBalance)}</strong>
        </p>
      </div>
      <details className="fund-members">
        <summary>
          सदस्यांचा तपशील ({num(members.length)}) •{" "}
          {num(members.filter((m) => m.paid > 0).length)} जणांनी रक्कम भरली
        </summary>
        <div className="fund-member-list">
          {members.map((m) => (
            <p key={m.id}>
              <span>{m.name}</span>
              <strong>{money(m.paid)}</strong>
            </p>
          ))}
          {!members.length && <p>या कालावधीत सदस्यांची नोंद नाही.</p>}
        </div>
      </details>
      <div className="section-heading">
        <h3>इतर जमा व शिल्लक</h3>
        {admin && (
          <button className="secondary" onClick={onAdd}>
            <Plus size={17} /> नोंद जोडा
          </button>
        )}
      </div>
      {f.entries.length === 0 ? (
        <p className="muted">अजून कोणतीही अतिरिक्त रक्कम नोंदवलेली नाही.</p>
      ) : (
        <div className="income-list">
          {[...f.entries]
            .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
            .map((e) => (
              <article className="income-item" key={e.id}>
                <div>
                  <span className={"income-kind " + e.kind}>
                    {incomeKinds[e.kind]}
                  </span>
                  <h3>{e.source}</h3>
                  <p className="income-meta">
                    {new Date(e.entry_date + "T12:00:00").toLocaleDateString(
                      "mr-IN",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                    {!month ? " • " + months[e.month - 1] : ""}
                  </p>
                  {e.note && <p className="income-note">{e.note}</p>}
                </div>
                <strong>{money(e.amount)}</strong>
                {admin && (
                  <button
                    className="icon"
                    aria-label={e.source + " नोंद बदला"}
                    onClick={() => onEdit(e)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </article>
            ))}
        </div>
      )}
      <p className="fund-footnote">
        या रकमांमुळे सदस्यांची वैयक्तिक बाकी बदलत नाही. मागील शिल्लक तिच्या
        नोंदवलेल्या महिन्यात व वर्षात एकदाच मोजली जाते.
      </p>
    </div>
  );
}
