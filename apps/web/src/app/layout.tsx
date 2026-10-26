import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Instrument_Serif } from "next/font/google";
import { TabBar } from "@/components/TabBar";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif" });
const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-sans" });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-mono" });

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
    <html lang="en-CA" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <TabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
