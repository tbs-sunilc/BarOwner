import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SipSave Bar Owner",
  description: "Operator dashboard for bar owners using SipSave.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
