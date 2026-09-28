import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { RegisterSW } from "@/components/RegisterSW";
import { APP_BLURB, APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — BHPH lot inventory audits`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_TAGLINE} ${APP_BLURB}`,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020817" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-paper font-sans text-ink dark:bg-navy dark:text-white">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <RegisterSW />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
