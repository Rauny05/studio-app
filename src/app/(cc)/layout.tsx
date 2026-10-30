import { Geist, Geist_Mono } from "next/font/google";
import "../../../styles/cc.css";
import { Shell } from "@/cc/components/Shell";

const geist = Geist({ subsets: ["latin"], variable: "--cc-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--cc-geist-mono", display: "swap" });

export const metadata = { title: "Command Center" };

export default function CCLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${geist.variable} ${geistMono.variable}`}><Shell>{children}</Shell></div>;
}
