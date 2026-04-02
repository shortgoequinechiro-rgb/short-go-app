import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import OfflineSync from "./components/OfflineSync";
import BillingGate from "./components/BillingGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chiro Stride | Animal Chiropractic Practice Management",
  description: "Practice management software built by animal chiropractors, for animal chiropractors. Offline-ready, AI-powered SOAP notes, and designed for the field.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chiro Stride",
  },
  openGraph: {
    title: "Chiro Stride | Animal Chiropractic Practice Management",
    description: "Practice management software built by animal chiropractors, for animal chiropractors. Offline-ready, AI-powered SOAP notes, and designed for the field.",
    url: "https://shortgochiro.com",
    siteName: "Chiro Stride",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chiro Stride | Animal Chiropractic Practice Management",
    description: "Practice management software built by animal chiropractors, for animal chiropractors.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: '#0e1e38' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavBar />
        <BillingGate>
          {children}
        </BillingGate>
        <OfflineSync />
      </body>
    </html>
  );
}
