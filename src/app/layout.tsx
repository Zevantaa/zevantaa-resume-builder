import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
