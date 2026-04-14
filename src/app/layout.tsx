import { Metadata, Viewport } from "next";
import "../../styles/global.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Studio",
  description: "Creative studio workspace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
