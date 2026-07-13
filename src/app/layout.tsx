import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "공간기억 위치 실험",
  description: "연구용 공간기억 위치 응답 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
