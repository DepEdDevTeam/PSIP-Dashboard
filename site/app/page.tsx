import Link from 'next/link';
import Image from 'next/image';
import { Building2, CircleHelp, House, LogIn, Menu } from 'lucide-react';
import { DashboardDataPreloader } from '@/components/dashboard-data-preloader';
import { LandingAnimation } from '@/components/landing-animation';
import { TrackProjectsLink } from '@/components/track-projects-link';

function Mark() {
  return (
    <div aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0b2b67] shadow-sm">
      <Building2 className="size-7 text-[#d8c079]" strokeWidth={1.75} />
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing-page min-h-dvh bg-[#f7f8fb] text-[#203f7d]">
      <DashboardDataPreloader />
      <LandingAnimation />
      <section className="landing-hero relative flex min-h-dvh flex-col overflow-hidden">
        {/* The source photo has white side borders; crop them with a centered 20% zoom. */}
        <div className="absolute inset-0 scale-[1.2] bg-[url('/school-campus.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.82)_31%,rgba(255,255,255,0.10)_72%,rgba(10,38,91,0.10)_100%)]" />

        <header className="relative z-10 flex items-center justify-between px-7 py-7 md:px-12 lg:px-14">
          <div className="flex items-center gap-3.5">
            <Mark />
            <div className="leading-none">
              <p className="mb-1.5 text-[0.68rem] font-extrabold tracking-[0.14em] sm:text-sm">DEPARTMENT OF EDUCATION</p>
              <p className="text-xl font-bold tracking-[-0.04em] sm:text-[1.7rem]">PPP Dashboard</p>
            </div>
          </div>

          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-lg font-bold lg:flex"><Link href="/dashboard#submit-site-photo" className="inline-flex min-h-11 items-center">Submit Site Update</Link>
            <a href="#home" className="flex items-center gap-2 underline decoration-2 underline-offset-4"><House className="size-5 fill-current" />Home</a>
            <a href="#about" className="flex items-center gap-2"><Building2 className="size-5" />About</a>
            <a href="#faqs" className="flex items-center gap-2"><CircleHelp className="size-5" />FAQs</a>
            <button aria-label="Open navigation menu" className="rounded-md p-1.5 transition hover:bg-[#203f7d]/10"><Menu className="size-8" /></button>
            <a href="#login" className="flex items-center gap-1.5 rounded-xl bg-[#3c578d]/90 px-3 py-2 text-white shadow-[0_10px_25px_rgba(16,38,86,0.2)] transition hover:bg-[#304b80]"><span>Log in</span><LogIn className="size-5" /></a>
          </nav>
          <Link href="/dashboard#submit-site-photo" className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[#3c578d] px-3 text-sm font-bold text-white lg:hidden">Submit Site Update</Link>
        </header>

        <div id="home" className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-28 text-center md:pb-32">
          <h1 className="max-w-4xl text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-[#264583] drop-shadow-[0_4px_0_rgba(255,255,255,0.92)] sm:text-6xl md:text-7xl">
            Building Learning Spaces<br />Through Partnerships
          </h1>
          <p className="mt-9 max-w-3xl text-lg font-medium leading-[1.02] tracking-wide text-[#294783] sm:text-2xl">
            Explore DepEd’s Public-Private Partnership infrastructure<br className="hidden sm:block" /> projects and monitor their readiness across DepEd schools.
          </p>
          <TrackProjectsLink />
        </div>

        <footer className="relative z-10 flex min-h-27 items-center justify-between bg-[#0e3170] px-8 py-5 text-white md:px-12 lg:px-14">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative h-16 w-36 shrink-0 overflow-hidden mix-blend-screen sm:w-44">
              <Image
                src="/deped-bagong-pilipinas.png"
                alt="DepEd Department of Education and Bagong Pilipinas"
                width={2560}
                height={1517}
                className="absolute -top-4 left-0 h-auto w-full sm:-top-5"
              />
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-white/90"><Building2 className="size-5" /></span>
          </div>
          <p className="text-base font-extrabold sm:text-xl">COPYRIGHT 2026</p>
        </footer>
      </section>
    </main>
  );
}
