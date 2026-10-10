import Link from "next/link";
import { Plus, Briefcase, Sparkles, Building } from "lucide-react";
import { getBriefs } from "@/lib/services/briefs";
import { BriefCard } from "@/components/BriefCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brand Campaign Briefs | Prismora",
  description:
    "Explore active generative AI creative briefs posted by visionary brands and creative agencies.",
};

export default async function BriefsPage() {
  const { data: briefs, isMock } = await getBriefs();

  return (
    <div className="flex-1 w-full bg-[#0b0914] min-h-[calc(100vh-4rem)] flex">
      {/* Left Sidebar (Desktop Navigation matching Screen 02 & 03) */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-[#1d1633] bg-[#0c0917] p-6 shrink-0">
        <div className="space-y-8">
          <div className="text-[11px] font-mono tracking-wider text-[#6b628a] uppercase font-semibold">
            WORKSPACE NAVIGATION
          </div>

          <nav className="space-y-2">
            <Link
              href="/creators"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[#9288b0] hover:text-white hover:bg-[#16102a] font-medium text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#7e749e]" />
              Discover
            </Link>

            <Link
              href="/briefs"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#201938] border border-[#382b61] text-[#c4b5fd] font-semibold text-sm transition-colors shadow-sm"
            >
              <Briefcase className="w-4 h-4 text-[#9d7bf5]" />
              Briefs
            </Link>

            <Link
              href="/briefs/new"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[#9288b0] hover:text-white hover:bg-[#16102a] font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-[#7e749e]" />
              New Brief
            </Link>
          </nav>
        </div>

        {/* Bottom Profile Pill */}
        <div className="pt-6 border-t border-[#1d1633] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#9d7bf5] text-[#0b0914] flex items-center justify-center font-bold text-sm shadow-md shadow-[#9d7bf5]/20">
            <Building className="w-5 h-5 text-[#0b0914]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">Brand Studio</p>
            <p className="text-[10px] text-[#7e749e] font-mono truncate">
              Client Workspace
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 md:py-10 w-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-[#1d1633]">
          <div>
            <span className="text-[11px] font-mono tracking-widest text-[#8c82ab] uppercase font-semibold">
              COMMISSION AI TALENT
            </span>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Brand & Agency Briefs
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-[#9b92b6] max-w-2xl leading-relaxed">
              Discover commercial briefs seeking generative video directors, 3D artists, and AI stylists.
              Review campaign objectives, style preferences, aspect ratios, and commercial licenses.
            </p>
          </div>

          <Link
            href="/briefs/new"
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#9d7bf5] hover:bg-[#b094fa] text-[#0b0914] font-bold text-xs transition-all shadow-md shadow-[#9d7bf5]/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create a brief
          </Link>
        </div>

        {/* Briefs Grid */}
        <div className="mt-8">
          {briefs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {briefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#271f43] bg-[#140f26] p-12 text-center flex flex-col items-center justify-center">
              <Briefcase className="w-10 h-10 text-[#7e749e] mb-3" />
              <h3 className="text-lg font-bold text-white">No active briefs yet</h3>
              <p className="mt-1 text-sm text-[#8c82ab] max-w-md">
                Create a campaign brief to commission vetted generative AI directors for your project.
              </p>
              <Link
                href="/briefs/new"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#9d7bf5] text-[#0b0914] text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Post the First Brief
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
