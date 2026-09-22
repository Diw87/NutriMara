import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriMara | Consultório digital",
  description: "Organize pacientes, consultas, evolução e planos alimentares no NutriMara.",
  icons: {
    icon: "/marakesia-logo.png",
    shortcut: "/marakesia-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
