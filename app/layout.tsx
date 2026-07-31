import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "satun-risk-gallery.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "คลังสื่อสารความเสี่ยง จังหวัดสตูล",
      template: "%s | คลังสื่อสารความเสี่ยง จังหวัดสตูล",
    },
    description:
      "ศูนย์รวมสื่อเพื่อเตรียมพร้อม รับมือ และฟื้นฟูจากอุบัติการณ์ต่างๆ ในจังหวัดสตูล",
    openGraph: {
      type: "website",
      locale: "th_TH",
      title: "รู้ก่อน เตรียมพร้อม รับมือไปด้วยกัน",
      description: "คลังสื่อสารความเสี่ยง สำนักงานสาธารณสุขจังหวัดสตูล",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "คลังสื่อสารความเสี่ยง จังหวัดสตูล" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "รู้ก่อน เตรียมพร้อม รับมือไปด้วยกัน",
      description: "คลังสื่อสารความเสี่ยง สำนักงานสาธารณสุขจังหวัดสตูล",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
