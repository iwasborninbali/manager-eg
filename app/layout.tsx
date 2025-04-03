import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootClientLayout from './RootClientLayout';

// Instantiate fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Optional: improve font loading
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap', // Optional: improve font loading
});

// Metadata needs to be in a Server Component
export const metadata: Metadata = {
  title: "CEO EG App",
  description: "Project Management App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-neutral-50 dark:bg-neutral-950 antialiased">
        <RootClientLayout>
          {children}
        </RootClientLayout>
      </body>
    </html>
  );
}
