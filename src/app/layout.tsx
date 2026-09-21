import type { Metadata, Viewport } from "next";
import { Dosis, Noto_Serif_Devanagari } from "next/font/google";
import Script from "next/script";
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

const SITE_URL = "https://dhunzza.vercel.app";
const SITE_TITLE = "Dhunzza — 90s Hindi Radio | Old Hindi Songs, Playing All Day";
const SITE_DESCRIPTION =
  "Dhunzza is a free nostalgic Hindi radio — nonstop old Bollywood songs, mood-based categories, and pure desi vibes, playing all day. Tap in and tune in to Dhunzza.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Dhunzza",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Dhunzza",
  keywords: [
    "Dhunzza",
    "Dhunzza radio",
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
  verification: {
    other: {
      "google-adsense-account": "ca-pub-7274193441004898",
    },
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
      { url: "/icons/dhunzza-icon.jpg", type: "image/jpeg" },
    ],
    apple: "/icons/dhunzza-icon.jpg",
    shortcut: "/icons/icon.svg",
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Old songs. Pure desi vibes. Timeless Hindi songs, playing all day.",
    url: SITE_URL,
    siteName: "Dhunzza",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/icons/dhunzza-icon.jpg",
        width: 1264,
        height: 1264,
        alt: "Dhunzza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Old songs. Pure desi vibes. Timeless Hindi songs, playing all day.",
    images: ["/icons/dhunzza-icon.jpg"],
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
  name: "Dhunzza",
  alternateName: ["Dhunzza Radio"],
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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7274193441004898"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
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
