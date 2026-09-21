import type { Metadata, Viewport } from "next";
import { Dosis, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/context/PlayerContext";
import AmbientBackground from "@/components/AmbientBackground";
import RootChrome from "@/components/RootChrome";

const dosis = Dosis({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

const SITE_URL = "https://desimahol.vercel.app";
const SITE_TITLE = "Desi Mahol — 90s Hindi Radio | Old Hindi Songs, Playing All Day";
const SITE_DESCRIPTION =
  "Desi Mahol is a free nostalgic Hindi radio — nonstop old Bollywood songs, mood-based categories, and pure desi vibes, playing all day. Tap in and tune in to Desi Mahol.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Desi Mahol",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Desi Mahol",
  keywords: [
    "Desi Mahol",
    "Desi Mahol radio",
    "Mahol",
    "Desi",
    "Desim",
    "Hindi radio",
    "old Hindi songs",
    "90s Hindi songs",
    "Bollywood radio",
    "nostalgic Hindi music",
  ],
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/desi-mahol-icon.jpg", type: "image/jpeg" },
    ],
    apple: "/icons/desi-mahol-icon.jpg",
    shortcut: "/icons/icon.svg",
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Old songs. Pure desi vibes. Timeless Hindi songs, playing all day.",
    url: SITE_URL,
    siteName: "Desi Mahol",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/icons/desi-mahol-icon.jpg",
        width: 1264,
        height: 1264,
        alt: "Desi Mahol",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Old songs. Pure desi vibes. Timeless Hindi songs, playing all day.",
    images: ["/icons/desi-mahol-icon.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#8E2F25",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Desi Mahol",
  alternateName: ["Desi", "Mahol", "Desim", "Desi Mahol Radio"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "hi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className={`${dosis.variable} ${notoSerifDevanagari.variable}`}>
      <body className="font-[family-name:var(--font-body)] antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static, hardcoded JSON-LD, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PlayerProvider>
          <AmbientBackground />
          <RootChrome>{children}</RootChrome>
        </PlayerProvider>
      </body>
    </html>
  );
}
