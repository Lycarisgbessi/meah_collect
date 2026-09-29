import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MEAH COLLECT — Formulaires collaboratifs à liens dérivés",
  description:
    "Créez un formulaire une seule fois, invitez votre équipe et collectez chaque réponse sous le nom du bon membre. Élégant, traçable, exportable.",
  keywords: ["formulaire", "collecte", "équipe", "liens dérivés", "prospection", "sondage"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${inter.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Sonner position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
