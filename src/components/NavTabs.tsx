"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    path: "/",
    label: (
      <>Lottery<br />Simulator</>
    ),
  },
  {
    path: "/prospects",
    label: (
      <>Draft<br />Prospects</>
    ),
  },
  {
    path: "/analytics",
    label: (
      <>Hockey<br />Analytics</>
    ),
  },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-3 pb-1">
      <div className="grid grid-cols-3 w-full gap-3 md:gap-4">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/" ? pathname === "/" : pathname.startsWith(tab.path);

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`w-full h-full px-2 md:px-5 py-1.5 border-4 uppercase text-[9px] md:text-sm leading-snug tracking-widest flex items-center justify-center text-center transition-all ${
                isActive
                  ? "bg-black text-[#96EDF6] border-black cursor-default shadow-none hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                  : "bg-white text-black border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-[#E5E5E5] hover:text-black hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
              }`}
              style={{ fontFamily: 'var(--font-press-start)' }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
