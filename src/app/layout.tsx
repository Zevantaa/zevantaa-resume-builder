import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { BRAND_FONT_FAMILY } from "@/features/branding/brand-settings-config";
import { brandMarkPath, getBrandSettings } from "@/features/branding/brand-settings-service";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const inter = Inter({ variable: "--font-brand-inter", subsets: ["latin"], display: "swap" });

const baseMetadata: Metadata = {
  title: "Zevantaa Resume Builder",
  description: "Zevantaa Careers multi-market resume builder and portal",
  icons: {
    icon: [
      {
        url: "/branding/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
      {
        url: "/branding/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/branding/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/branding/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    shortcut: "/branding/favicon.ico",
    apple: [
      {
        url: "/branding/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBrandSettings();
  if (!settings.markObjectKey) return baseMetadata;
  return { ...baseMetadata, icons: { icon: brandMarkPath(settings), shortcut: brandMarkPath(settings) } };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getBrandSettings();
  const brandStyle = { "--brand-ui-font": BRAND_FONT_FAMILY[settings.uiFont],
    "--brand-heading-font": BRAND_FONT_FAMILY[settings.headingFont],
    "--brand-accent": settings.accentColor } as CSSProperties;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
      style={brandStyle}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
