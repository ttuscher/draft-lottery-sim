// src/app/layout.tsx
import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import Ticker from "../components/Ticker";

// Configure the 8-bit font
const pressStart2P = Press_Start_2P({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-press-start',
});

export const metadata: Metadata = {
  title: "Retro Hockey Draft Simulator",
  description: "Clean Ice Edition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Added pb-16 (padding-bottom) so the ticker doesn't overlap page content */}
      <body className={`${pressStart2P.variable} font-retro antialiased min-h-screen flex flex-col pb-16`}>
        
        {/* Global Header */}
        <header className="bg-black text-white p-4 border-b-8 border-[#E2231A] uppercase tracking-widest text-center shadow-lg relative z-10">
          <h1 className="text-xl md:text-2xl" style={{ fontFamily: 'var(--font-press-start)' }}>
            NHL Draft Lottery Simulator
          </h1>
          <p className="text-[#96EDF6] text-xs mt-2" style={{ fontFamily: 'var(--font-press-start)' }}>
            Clean Ice Edition
          </p>
        </header>

        {/* Main Content Area */}
        <div className="flex-grow">
          {children}
        </div>

        {/* Global Broadcast Ticker */}
        <Ticker />

      </body>
    </html>
  );
}