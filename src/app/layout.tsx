import type { Metadata, Viewport } from "next";
import { Dosis, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/context/PlayerContext";
import EraBackground from "@/components/EraBackground";
import TimeTravelOverlay from "@/components/TimeTravelOverlay";
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
      { url: "/dhunzza-logo-exact.svg", type: "image/svg+xml" },
      { url: "/dhunzza.webp", type: "image/webp" },
    ],
    apple: "/dhunzza.webp",
    shortcut: "/dhunzza-logo-exact.svg",
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
        url: "/dhunzza.webp",
        width: 1254,
        height: 1254,
        alt: "Dhunzza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Old songs. Pure desi vibes. Timeless Hindi songs, playing all day.",
    images: ["/dhunzza.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#8E2F25",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Dhunzza",
      alternateName: ["Dhunzza Radio"],
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "hi",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Dhunzza",
      alternateName: ["Dhunzza Radio"],
      url: SITE_URL,
      logo: `${SITE_URL}/dhunzza.webp`,
      // Once you have live social/profile URLs (Instagram, X, etc.), add a
      // `sameAs: [...]` array here — that's what teaches Google "Dhunzza"
      // is a distinct real-world entity, not a misspelling of a bigger,
      // similar-looking brand.
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className={`${dosis.variable} ${notoSerifDevanagari.variable}`}>
      <head>
        {/* Plain <script>, not next/script — AdSense's head-tag validator
            rejects the `data-nscript` attribute next/script's <Script>
            component stamps on every tag it renders. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7274193441004898"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-[family-name:var(--font-body)] antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static, hardcoded JSON-LD, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PlayerProvider>
          <EraBackground />
          <TimeTravelOverlay />
          <RootChrome>{children}</RootChrome>
        </PlayerProvider>
      </body>
    </html>
  );
}
