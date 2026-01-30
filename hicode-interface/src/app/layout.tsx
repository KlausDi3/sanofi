import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HICODE - Data Analysis Interface",
  description: "Hierarchical Inductive Coding with LLMs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full font-secondary bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
