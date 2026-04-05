const sections = [
  {
    title: "Core progression",
    items: [
      "1 QP always equals 2,000 EXP.",
      "EXP needed for the next level is current level x 1,000.",
      "Extra EXP carries over after leveling up.",
      "Titles change by level range: Apprentice, Student, Adept, Craftsman, Master, Architect.",
    ],
  },
  {
    title: "Tasks",
    items: [
      "Every task has an anchor routine and a full routine.",
      "Full completion counts as anchor completion and grants both the anchor QP and the full QP for that task.",
      "Users can customize tasks, edit them, and archive them anytime.",
      "Tasks repeat daily.",
    ],
  },
  {
    title: "Bonuses and streaks",
    items: [
      "Complete all task anchors in a day to gain +1 bonus QP.",
      "Complete 3 or more full routines in a day to gain +2 bonus QP once.",
      "If yesterday already earned at least 1 QP and today earns at least 1 QP before streak bonus, the streak continues and grants +1 QP.",
      "Quest Passes are earned at levels 10, 20, 30, and so on.",
      "Quest Passes auto-complete a full day and count for streaks and bonuses.",
    ],
  },
  {
    title: "Recovery and edits",
    items: [
      "A 0-QP day creates a punishment obligation that must be assigned and completed.",
      "Users can edit the last 7 days if they forgot to log or had no internet.",
      "Editing a past day recalculates QP, EXP, streak, levels, titles, and quest pass history.",
      "Each day has one private journal entry, which can be edited.",
    ],
  },
];

export default function RulesPage() {
  return (
    <section className="grid gap-4">
      <div className="quest-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="page-label">Rules</p>
            <h1 className="page-title">System guide</h1>
          </div>
          <span className="status-pill">
            <strong>{sections.length}</strong> sections
          </span>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="quest-panel">
          <h2 className="font-serif text-2xl text-stone-50">{section.title}</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-stone-300">
            {section.items.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
