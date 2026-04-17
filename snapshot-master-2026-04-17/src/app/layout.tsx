// src/app/layout.tsx
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import Ticker from "../components/Ticker";
import NavTabs from "../components/NavTabs";

// Configure the 8-bit font
const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ["latin"],
  variable: '--font-press-start',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.variable} font-retro antialiased min-h-screen flex flex-col bg-[#96EDF6]`}>

        {/* Global Header */}
        <header className="bg-black p-3 border-b-[7px] border-[#E2231A] uppercase tracking-widest text-center shadow-lg sticky top-0 z-50">
          <a
            href="/"
            className="text-xl md:text-3xl text-white leading-snug mx-auto block hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              fontFamily: 'var(--font-press-start)',
              WebkitTextStroke: '1px #96EDF6',
              textShadow: '2px 2px 0 #96EDF6'
            }}
          >
            PUCKSON.NET
          </a>
        </header>

        {/* Global Navigation Tabs (client component) */}
        <NavTabs />

        {/* Main Content Area */}
        <main className="w-full flex flex-col items-center">
          {children}
        </main>

        {/* Global Broadcast Ticker */}
        <Ticker />

        {/* Legal Disclaimer */}
        <footer className="w-full max-w-5xl mx-auto px-4 pb-14 md:pb-16 pt-1 text-center">
          <p className="text-[7px] sm:text-[9px] md:text-[11px] leading-relaxed text-black/50" style={{ fontFamily: 'var(--font-press-start)' }}>
            NHL and the NHL Shield are registered trademarks of the National Hockey League.<br className="hidden md:inline" /> All NHL logos and marks are property of the NHL and its teams.<br className="hidden md:inline" /> This site is not affiliated with or endorsed by the NHL.
          </p>
        </footer>

      </body>
    </html>
  );
}
