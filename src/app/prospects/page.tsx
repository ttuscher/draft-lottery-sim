export default function ProspectRankingsPage() {
  return (
    <section className="w-full flex flex-col items-center pb-2" style={{ fontFamily: 'var(--font-press-start)' }}>
      <div className="w-full max-w-5xl px-4 flex flex-col items-center mt-4">
        <div className="w-full bg-white border-4 border-black p-3 md:p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)]">
          <h2 className="text-sm sm:text-base md:text-xl mb-3 text-center border-b-4 border-black pb-2 text-[#E2231A] uppercase tracking-wider whitespace-nowrap">
            2026 PROSPECT RANKINGS
          </h2>
          <p className="text-xs md:text-sm text-center py-8 text-gray-400 uppercase tracking-widest animate-pulse">
            Prospect rankings and analyst leaderboards coming soon...
          </p>
        </div>
      </div>
    </section>
  );
}
