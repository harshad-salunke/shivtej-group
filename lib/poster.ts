import {
  type Data,
  current,
  eligible,
  record,
  monthRows,
  fundSummary,
  months,
  money,
  num,
  today,
} from "./model";
import { LOGO_SRC } from "./brand";
export type ReportRow = {
  name: string;
  paid: number;
  due: number;
  status: "paid" | "partial" | "unpaid" | "future";
};
export function reportData(data: Data, year: number, month?: number) {
  const now = current();
  const end = year < now.year ? 12 : year === now.year ? now.month : 0;
  const rows: ReportRow[] = month
    ? monthRows(data, year, month).map((r) => ({
        name: r.member.name,
        paid: r.paid,
        due: r.due,
        status: r.status as ReportRow["status"],
      }))
    : data.members
        .filter((m) =>
          Array.from({ length: 12 }, (_, i) => i + 1).some((mo) =>
            eligible(m, year, mo),
          ),
        )
        .sort((a, b) => a.display_order - b.display_order)
        .map((m) => {
          const elapsed = Array.from({ length: end }, (_, i) => i + 1)
            .filter((mo) => eligible(m, year, mo))
            .map((mo) => record(data, m, year, mo));
          const due =
            elapsed.reduce((a, r) => a + Math.round(r.due * 100), 0) / 100;
          const paid =
            data.payments
              .filter((p) => p.member_id === m.id && p.year === year)
              .reduce((a, p) => a + Math.round(p.amount_paid * 100), 0) / 100;
          return {
            name: m.name,
            paid,
            due,
            status: !elapsed.length
              ? "future"
              : due === 0
                ? "paid"
                : elapsed.some((r) => r.paid > 0)
                  ? "partial"
                  : "unpaid",
          };
        });
  return {
    rows,
    funds: fundSummary(data, year, month),
    title: month
      ? `${months[month - 1]} ${num(year)}`
      : `वार्षिक आढावा ${num(year)}`,
    period: month
      ? "मासिक वर्गणीचा तपशील"
      : end
        ? `बाकीचा हिशोब: ${months[end - 1]} ${num(year)} पर्यंत`
        : "आगाऊ नोंदी • या वर्षाची वर्गणी अद्याप देय नाही",
    due: rows.reduce((a, r) => a + Math.round(r.due * 100), 0) / 100,
  };
}
const labels = {
  paid: "भरले",
  partial: "अंशतः भरले",
  unpaid: "बाकी",
  future: "अद्याप देय नाही",
};
const colors = {
  paid: "#287447",
  partial: "#946a10",
  unpaid: "#b44738",
  future: "#77746d",
};
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const segment of new Intl.Segmenter("mr", {
    granularity: "grapheme",
  }).segment(text)) {
    if (line && ctx.measureText(line + segment.segment).width > width) {
      lines.push(line);
      line = "";
    }
    line += segment.segment;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
export async function generatePosters(
  data: Data,
  year: number,
  month?: number,
) {
  await document.fonts.load(
    '400 28px "Noto Sans Devanagari"',
    "मराठी वर्गणी ₹१२३",
  );
  await document.fonts.load(
    '700 42px "Noto Sans Devanagari"',
    "मराठी वर्गणी ₹१२३",
  );
  await document.fonts.ready;
  const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(Error("लोगो लोड झाला नाही. कृपया पुन्हा प्रयत्न करा."));
    img.src = LOGO_SRC;
  });
  const report = reportData(data, year, month);
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = '400 28px "Noto Sans Devanagari"';
  const rows = report.rows.map((r) => ({
    ...r,
    lines: wrap(measure, r.name, 380),
    height: Math.max(58, wrap(measure, r.name, 380).length * 36 + 20),
  }));
  const pages: (typeof rows)[] = [];
  let page: typeof rows = [];
  let height = 0;
  for (const r of rows) {
    if (page.length && (height + r.height > 1370 || page.length >= 24)) {
      pages.push(page);
      page = [];
      height = 0;
    }
    page.push(r);
    height += r.height;
  }
  if (page.length || !pages.length) pages.push(page);
  const outputs: { file: File; url: string }[] = [];
  for (let index = 0; index < pages.length; index++) {
    const entries = pages[index];
    const bodyHeight = entries.reduce((a, r) => a + r.height, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = Math.max(1150, bodyHeight + 850);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fffaf1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#dc571a";
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 1040, canvas.height - 40);
    ctx.save();
    ctx.globalAlpha = 0.075;
    ctx.drawImage(
      logo,
      80,
      canvas.height / 2 - 310,
      920,
      (920 * logo.height) / logo.width,
    );
    ctx.restore();
    const text = (
      value: string,
      x: number,
      y: number,
      size: number,
      color = "#302b23",
      bold = false,
      align: CanvasTextAlign = "left",
    ) => {
      ctx.font = `${bold ? 700 : 400} ${size}px "Noto Sans Devanagari"`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(value, x, y);
    };
    ctx.drawImage(logo, 430, 40, 220, (220 * logo.height) / logo.width);
    text("शिवतेज ग्रुप वाखारी", 540, 235, 44, "#c94b12", true, "center");
    text(
      "साऊंड सिस्टीम • नियोजन २०२७",
      540,
      280,
      26,
      "#88715b",
      false,
      "center",
    );
    text(report.title, 540, 339, 34, "#302b23", true, "center");
    text(report.period, 540, 382, 23, "#88715b", false, "center");
    if (data.demo)
      text(
        "नमुना माहिती — प्रत्यक्ष आर्थिक नोंद नाही",
        540,
        420,
        23,
        "#bc3e2b",
        true,
        "center",
      );
    ctx.fillStyle = "#f9e8d5";
    ctx.fillRect(55, 443, 970, 101);
    text("सदस्य वर्गणी", 88, 478, 23);
    text(money(report.funds.memberPaid), 88, 523, 32, "#c94b12", true);
    text("इतर जमा / शिल्लक", 430, 478, 23);
    text(money(report.funds.extra), 430, 523, 32, "#c94b12", true);
    text("एकूण निधी", 970, 478, 23, "#302b23", false, "right");
    text(money(report.funds.total), 970, 523, 32, "#c94b12", true, "right");
    text(
      `सदस्य: ${num(report.rows.length)}  •  पूर्ण भरले: ${num(report.rows.filter((r) => r.status === "paid").length)}  •  वर्गणी बाकी: ${money(report.due)}`,
      60,
      585,
      24,
    );
    ctx.fillStyle = "#ebd8bd";
    ctx.fillRect(55, 606, 970, 45);
    text("सदस्याचे नाव", 78, 637, 23, "#5e4d35", true);
    text("जमा", 658, 637, 23, "#5e4d35", true, "right");
    text("बाकी", 790, 637, 23, "#5e4d35", true, "right");
    text("स्थिती", 924, 637, 23, "#5e4d35", true, "center");
    let y = 656;
    for (const r of entries) {
      ctx.fillStyle = "#d7cbbb";
      ctx.fillRect(55, y + r.height - 1, 970, 1);
      r.lines.forEach((line, i) => text(line, 78, y + 35 + i * 36, 28));
      text(money(r.paid), 658, y + 35, 27, "#36573d", true, "right");
      text(
        money(r.due),
        790,
        y + 35,
        26,
        r.due ? "#ad4939" : "#686154",
        false,
        "right",
      );
      text(
        labels[r.status],
        924,
        y + 35,
        r.status === "future" ? 20 : 23,
        colors[r.status],
        true,
        "center",
      );
      y += r.height;
    }
    if (!entries.length)
      text(
        "या कालावधीसाठी सदस्यांची नोंद नाही.",
        540,
        719,
        28,
        "#88715b",
        false,
        "center",
      );
    const fy = canvas.height - 76;
    text(
      "योगदान दिलेल्या सर्व सदस्यांचे मनःपूर्वक आभार!",
      540,
      fy - 49,
      29,
      "#c94b12",
      true,
      "center",
    );
    text(
      `${today()} • पान ${num(index + 1)} / ${num(pages.length)} • एकूण रक्कम सर्व पानांसाठी`,
      540,
      fy,
      21,
      "#88715b",
      false,
      "center",
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("चित्र तयार झाले नाही."))),
        "image/png",
      ),
    );
    const file = new File(
      [blob],
      `shivtej-${year}-${month ? String(month).padStart(2, "0") : "year"}-${index + 1}.png`,
      { type: "image/png" },
    );
    outputs.push({ file, url: URL.createObjectURL(blob) });
  }
  return outputs;
}
