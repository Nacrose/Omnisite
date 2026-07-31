import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniSite — Enterprise Construction Management",
  description: "Unified cloud platform for Pre-construction, Planning, Procurement, Site Execution, Project Controls and Document Management. Built for Nepali construction realities.",
  keywords: ["OmniSite", "Construction Management", "BOQ", "Rate Analysis", "Gantt", "DoR Norms", "FIDIC"],
  authors: [{ name: "OmniSite" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground theme-transition`}
      >
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              {children}
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* Single Sonner Toaster mounted at the app root — all `toast.*` calls
            from any component render here. Per-component Toasters were removed
            to prevent duplicate toasts on every call. */}
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  );
}
