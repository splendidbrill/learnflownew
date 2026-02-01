// import type { Metadata } from "next";
// import { Inter } from "next/font/google";
// import "./globals.css";

// const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "LearningFlux - AI Tutor",
//   description: "Learn complex topics with AI analogies",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body className={`${inter.className} bg-slate-950 text-white`}>
//         {children}
//       </body>
//     </html>
//   );
// }

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Use Inter (a standard, safe Google Font) instead of local files
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LearningFlux",
  description: "AI Tutor Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* We apply the font and your dark background color here */}
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}