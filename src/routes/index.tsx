import { Link, createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(10, 15, 30, 0.68), rgba(10, 15, 30, 0.78)), url('https://iacmr.org/wp-content/uploads/sites/26/2025/05/image001-4-1024x683.jpg')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_40%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/90 text-base font-semibold text-white shadow-lg shadow-cyan-900/30">
              U
            </div>
            <div>
              <p className="text-sm font-semibold">University</p>
              <p className="text-xs text-slate-200/80">Academic Portal</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-100/85 md:flex">
            <a href="#about" className="transition hover:text-white">
              About
            </a>
            <a href="#announcements" className="transition hover:text-white">
              Public Announcements
            </a>
            <a href="#guidelines" className="transition hover:text-white">
              Guidelines
            </a>
          </nav>

          <Button
            asChild
            variant="outline"
            className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
          >
            <Link to="/login" search={{ redirect: undefined }}>
              Access System
            </Link>
          </Button>
        </header>

        <section className="flex flex-1 items-center justify-center py-16">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="border border-cyan-400/25 bg-blue-500/15 px-4 py-1 text-cyan-100 hover:bg-blue-500/15">
              Coursework Review System
            </Badge>

            <h1 className="mt-8 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Coursework Review System
              <span className="block text-cyan-300">for Code Similarity Detection</span>
              <span className="block text-teal-300">and Evidence Chain Generation</span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-100/80">
              Built for academic integrity. Detect code similarity and generate verifiable evidence chains for fair and
              transparent coursework evaluation.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-xl bg-gradient-to-r from-blue-500 to-emerald-400 px-8 text-white shadow-lg shadow-cyan-900/30 hover:from-blue-400 hover:to-emerald-300"
              >
                <Link to="/login" search={{ redirect: undefined }}>
                  Get Started
                </Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-100/75">
              {['Code Similarity Detection', 'Evidence Chain Generation', 'Secure Submission Portal'].map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/8 px-4 py-2 backdrop-blur-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <footer className="pb-2 text-center text-xs text-slate-200/65">
          © 2026 University Graduation Thesis System. All rights reserved.
        </footer>
      </div>
    </main>
  )
}
