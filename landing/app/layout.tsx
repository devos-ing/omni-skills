import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { metadata } from "./metadata";
import "./globals.css";

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>{children}</body>
    </html>
  );
}
