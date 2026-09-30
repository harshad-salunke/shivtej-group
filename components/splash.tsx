"use client";
import { useEffect, useState } from "react";
import { LOGO_SRC } from "@/lib/brand";
export default function Splash() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("shivtej-welcome")) return;
      sessionStorage.setItem("shivtej-welcome", "1");
    } catch {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <div className="splash" aria-hidden="true">
      <img src={LOGO_SRC} alt="" />
      <strong>शिवतेज ग्रुप वाखारी</strong>
      <span>नियोजन 2027</span>
    </div>
  ) : null;
}
