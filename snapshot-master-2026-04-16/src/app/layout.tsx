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
      <body className={`${pressStart2P.variable} font-retro antialiased min-h-screen flex flex-col bg-[#96EDF6] pb-12`}>

        {/* Global Header */}
        <header className="bg-black p-3 border-b-[7px] border-[#E2231A] uppercase tracking-widest text-center shadow-lg relative z-10">
          <h1
            className="text-xl md:text-3xl text-white leading-snug mx-auto"
            style={{
              fontFamily: 'var(--font-press-start)',
              WebkitTextStroke: '1px #96EDF6',
              textShadow: '2px 2px 0 #96EDF6'
            }}
          >
            NHL DRAFT<br />LOTTERY SIMULATOR
          </h1>
        </header>

        {/* Global Navigation Tabs (client component) */}
        <NavTabs />

        {/* Main Content Area */}
        <main className="flex-grow w-full flex flex-col items-center">
          {children}
        </main>

        {/* Global Broadcast Ticker */}
        <Ticker />

        {/* Legal Disclaimer */}
        <footer className="w-full max-w-5xl mx-auto px-4 pb-4 pt-6 text-center">
          <p className="text-[5px] sm:text-[6px] md:text-[7px] leading-relaxed text-black/50" style={{ fontFamily: 'var(--font-press-start)' }}>
            NHL and the NHL Shield are registered trademarks of the National Hockey League. All NHL and team names, logos, and marks are property of the NHL and respective teams. This is an independent fan site and is not affiliated with, endorsed by, or sponsored by the NHL or any NHL team.
          </p>
        </footer>

      </body>
    </html>
  );
}
