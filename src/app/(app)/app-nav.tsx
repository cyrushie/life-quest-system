"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const baseNavItems = [
  { href: "/onboarding", label: "Setup" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/profile", label: "Profile" },
  { href: "/today", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/journal", label: "Journal" },
  { href: "/friends", label: "Friends" },
  { href: "/guild", label: "Guild" },
  { href: "/tasks", label: "Tasks" },
  { href: "/exercise", label: "Exercise" },
  { href: "/punishments", label: "Punishments" },
  { href: "/rules", label: "Rules" },
];

export function AppNav({ showSetupBadge = false }: { showSetupBadge?: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const activeItem = baseNavItems.find((item) => pathname === item.href);

  return (
    <>
      <div className="mobile-nav-panel mt-5 lg:hidden">
        <div className="mobile-nav-shell">
          <div className="mobile-nav-summary">
            <p className="mobile-nav-label">Navigation</p>
            <p className="mobile-nav-current">{activeItem?.label ?? "Menu"}</p>
          </div>
          <button
            aria-expanded={isOpen}
            className="mobile-nav-button"
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <span className="mobile-nav-button-label">{isOpen ? "Close" : "Open"}</span>
            <span aria-hidden="true" className="mobile-nav-button-icon">
              {isOpen ? "−" : "+"}
            </span>
          </button>
        </div>

        {isOpen ? (
          <nav className="mobile-nav-grid">
            {baseNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={`menu-link mobile-menu-link ${isActive ? "menu-link-active" : ""}`}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="mobile-menu-link-arrow">
                    ›
                  </span>
                  {showSetupBadge && item.href === "/onboarding" ? (
                    <span className="status-pill ml-auto">Required</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      <nav className="mt-5 hidden gap-2 lg:grid">
        {baseNavItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              className={`menu-link ${isActive ? "menu-link-active" : ""}`}
              href={item.href}
            >
              <span>{item.label}</span>
              {showSetupBadge && item.href === "/onboarding" ? (
                <span className="status-pill ml-auto">Required</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
