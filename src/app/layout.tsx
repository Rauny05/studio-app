import type { Metadata, Viewport } from "next";
import "../../styles/global.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "RM Studio",
    template: "%s | RM Studio",
  },
  description: "Content creator workspace — kanban, deliverables, reels, calendar, dashboard",
  manifest: "/manifest.json",
  applicationName: "RM Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RM Studio",
    startupImage: [
      {
        url: "/apple-touch-icon.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#6c28d9",
    "msapplication-tap-highlight": "no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#6c28d9" },
    { media: "(prefers-color-scheme: light)", color: "#6c28d9" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RM Studio" />
        <meta name="theme-color" content="#6c28d9" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
