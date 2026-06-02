import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "../app/learningflux/learningflux.css";

export const metadata: Metadata = {
  title: "LearningFlux — White-labeled AI tutoring for IIT-JEE institutes",
  description: "White-labeled AI tutoring infrastructure for serious IIT-JEE institutes. Your brand on the front. Our brain underneath.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
