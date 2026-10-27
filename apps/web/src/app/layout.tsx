import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { TabBar } from "@/components/TabBar";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const sans = Figtree({ subsets: ["latin"], variable: "--font-sans", fallback: ["system-ui", "Segoe UI", "sans-serif"] });

export const metadata: Metadata = {
  title: "Sylvia",
  description: "Know your wildfire risk, get early warnings, and make your yard burn slower.",
  applicationName: "Sylvia",
  appleWebApp: { capable: true, title: "Sylvia", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#121a15" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={sans.variable}>
      <body>
        {children}
        <TabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
