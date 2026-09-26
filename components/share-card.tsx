"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Share2, ImagePlus } from "lucide-react";
import { type Data, months, num } from "@/lib/model";
import { generatePosters } from "@/lib/poster";
import { LOGO_SRC } from "@/lib/brand";
export default function ShareCard({
  data,
  year,
  month,
}: {
  data: Data;
  year: number;
  month: number;
}) {
  const [scope, setScope] = useState<"month" | "year">("month"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [outputs, setOutputs] = useState<{ file: File; url: string }[]>([]),
    [message, setMessage] = useState("");
  const urls = useRef<string[]>([]);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    setOutputs([]);
    setMessage("");
    setError("");
    setBusy(false);
    return () => {
      generation.current++;
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, [data, year, month, scope]);
  async function generate() {
    const token = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await generatePosters(
        data,
        year,
        scope === "month" ? month : undefined,
      );
      if (token !== generation.current) {
        result.forEach((r) => URL.revokeObjectURL(r.url));
        return;
      }
      urls.current.forEach(URL.revokeObjectURL);
      urls.current = result.map((r) => r.url);
      setOutputs(result);
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function share() {
    const files = outputs.map((o) => o.file);
    setMessage("");
    if (navigator.share && navigator.canShare?.({ files })) {
      try {
        await navigator.share({
          files,
          title: "शिवतेज ग्रुप वाखारी",
          text: `${scope === "month" ? months[month - 1] + " " : ""}${num(year)} — वर्गणी आढावा. सर्वांच्या योगदानाबद्दल मनःपूर्वक आभार!`,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setMessage(
            "या फोनवर थेट चित्र शेअर झाले नाही. चित्र डाउनलोड करून WhatsApp मध्ये जोडा.",
          );
      }
    } else
      setMessage(
        "चित्र डाउनलोड करा → WhatsApp उघडा → ग्रुपमध्ये हे चित्र जोडा.",
      );
  }
  return (
    <section className="share-card">
      <div className="share-card-heading">
        <img src={LOGO_SRC} alt="शिवतेज लोगो" />
        <div>
          <span className="eyebrow">आपल्या सर्वांचे मनःपूर्वक आभार</span>
          <h2>वर्गणीचे आभारपत्र शेअर करा</h2>
          <p>
            सर्व सदस्यांची नावे, भरलेली रक्कम आणि बाकी — आपल्या ग्रुपच्या
            लोगोसह.
          </p>
        </div>
      </div>
      <div className="share-controls">
        <label className="field">
          <span>कोणता आढावा?</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "month" | "year")}
          >
            <option value="month">
              {months[month - 1]} {num(year)} — मासिक
            </option>
            <option value="year">{num(year)} — वार्षिक</option>
          </select>
        </label>
        <button className="primary" onClick={generate} disabled={busy}>
          <ImagePlus size={18} />
          {busy ? "चित्र तयार होत आहे…" : "चित्र तयार करा"}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {outputs.length > 0 && (
        <>
          <div className="poster-previews">
            {outputs.map((o, i) => (
              <figure key={o.url}>
                <img src={o.url} alt={`वर्गणी आभारपत्र, पान ${num(i + 1)}`} />
                <a className="secondary" href={o.url} download={o.file.name}>
                  <Download size={17} /> चित्र{" "}
                  {outputs.length > 1 ? num(i + 1) : ""} डाउनलोड
                </a>
              </figure>
            ))}
          </div>
          <button className="whatsapp-button" onClick={share}>
            <Share2 size={18} /> WhatsApp / शेअर
          </button>
          <p className="share-note">
            फोनच्या शेअर पर्यायात WhatsApp निवडा. थेट शेअर उपलब्ध नसल्यास चित्र
            डाउनलोड करून पाठवा.
          </p>
          {message && (
            <p role="status" className="share-note">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
