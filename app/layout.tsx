import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
  title: "शिवतेज ग्रुप वाखारी • नियोजन 2027",
  description:
    "साऊंड सिस्टीम वर्गणी — सदस्य, जमा रक्कम आणि बाकीचा पारदर्शक हिशोब.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mr">
      <body>{children}</body>
    </html>
  );
}
