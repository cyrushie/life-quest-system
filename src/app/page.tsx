import Image from "next/image";
import Link from "next/link";

const stats = [
  { label: "Daily loop", value: "Tasks -> QP -> EXP" },
  { label: "Fallback system", value: "Anchor routines" },
  { label: "Private log", value: "One journal each day" },
];

const contacts = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/cyrus.manguerra.905/",
    external: true,
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M13.5 20V12.8H15.9L16.3 10H13.5V8.2C13.5 7.39 13.72 6.84 14.89 6.84H16.4V4.34C15.67 4.26 14.94 4.22 14.2 4.22C12.02 4.22 10.53 5.55 10.53 8V10H8.12V12.8H10.53V20H13.5Z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:c.manguerra14@gmail.com",
    external: false,
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 7.5L12 13.25L20 7.5M5.2 19H18.8C19.46 19 20 18.46 20 17.8V6.2C20 5.54 19.46 5 18.8 5H5.2C4.54 5 4 5.54 4 6.2V17.8C4 18.46 4.54 19 5.2 19Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
];

const highlights = [
  {
    title: "Small progress still counts",
    body: "Anchor routines keep momentum alive when a full day is too much.",
  },
  {
    title: "Progress feels visible",
    body: "QP, EXP, levels, titles, streaks, and recovery all connect automatically.",
  },
  {
    title: "Built for actual use",
    body: "Custom tasks, private journaling, and a short edit window keep it practical.",
  },
];

const loop = [
  "Set your tasks with anchor and full versions.",
  "Log today's progress in a few taps.",
  "Watch your stats update automatically.",
];

export default function Home() {
  return (
    <main className="min-h-screen text-stone-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 lg:px-6">
        <header className="quest-panel flex flex-wrap items-center justify-between gap-4">
          <div>
            <Image
              alt="Life Quest System"
              className="h-auto w-full max-w-[18rem]"
              height="82"
              src="/logo-lockup.svg"
              width="290"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="quest-button quest-button-secondary" href="/login">
              Log in
            </Link>
            <Link className="quest-button" href="/register">
              Start
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-4 py-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="quest-panel flex flex-col justify-center">
            <span className="status-pill w-fit">
              <span className="status-dot" />
              Momentum over perfection
            </span>

            <h2 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.04] text-stone-50 sm:text-6xl">
              Your life, tracked like a clean character sheet.
            </h2>

            <p className="page-copy max-w-2xl">
              Life Quest turns daily effort into a simple game loop. Do the
              task, gain QP, earn EXP, keep your streak, and write the day down.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="quest-button" href="/register">
                Create character
              </Link>
              <Link
                className="quest-button quest-button-secondary"
                href="/rules"
              >
                View rules
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {stats.map((item) => (
                <article key={item.label} className="mini-card">
                  <p className="mini-card-label">{item.label}</p>
                  <p className="mt-3 text-sm leading-6 text-stone-200">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
              <p className="mini-card-label">Contact the creator</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {contacts.map((contact) => (
                  <a
                    key={contact.label}
                    aria-label={contact.label}
                    className="quest-button quest-button-secondary"
                    href={contact.href}
                    rel={contact.external ? "noreferrer" : undefined}
                    target={contact.external ? "_blank" : undefined}
                  >
                    {contact.icon}
                    <span>{contact.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="quest-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="page-label">Core loop</p>
                  <h3 className="mt-2 font-serif text-2xl text-stone-50">
                    How it feels
                  </h3>
                </div>
                <span className="status-pill">
                  <strong>3 steps</strong>
                </span>
              </div>

              <div className="mt-4 compact-list">
                {loop.map((step, index) => (
                  <article
                    key={step}
                    className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="status-pill">{index + 1}</span>
                      <p className="text-sm leading-7 text-stone-300">{step}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="quest-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="page-label">Why it works</p>
                  <h3 className="mt-2 font-serif text-2xl text-stone-50">
                    Highlights
                  </h3>
                </div>
                <span className="status-pill">
                  <strong>{highlights.length}</strong> points
                </span>
              </div>

              <div className="mt-4 compact-list">
                {highlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                  >
                    <p className="font-serif text-xl text-stone-50">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-400">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
