import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CYFR Board",
  description: "Внутренний таск-трекер для CYFR FITOUT L.L.C.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}