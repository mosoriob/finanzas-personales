"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Dashboard", href: "/" },
  { name: "Transacciones", href: "/transacciones" },
  { name: "Cuentas", href: "/cuentas" },
  { name: "Config", href: "/config" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[rgba(254,254,254,0.95)] backdrop-blur-xl border-b border-gray-100 px-10 py-3.5 flex justify-between items-center">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-indigo-500 to-violet-400 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
          <svg viewBox="0 0 46 32" fill="none" className="w-[22px] h-[22px]">
            <rect x="0" y="6" width="46" height="26" rx="5" stroke="#fff" strokeWidth="2.5" fill="none" />
            <path d="M7 6V3a5 5 0 015-5h22a5 5 0 015 5v3" stroke="#fff" strokeWidth="2.5" fill="none" />
            <circle cx="36" cy="19" r="4" stroke="#fff" strokeWidth="2" fill="none" />
            <line x1="36" y1="16.5" x2="36" y2="21.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-[family-name:var(--font-caveat)] text-2xl font-semibold text-gray-800 leading-none">
            mis finanzas
          </span>
          <span className="text-[10px] text-gray-400 tracking-wider mt-0.5">
            tu plata, tu control
          </span>
        </div>
      </Link>

      <div className="flex gap-1.5">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all no-underline ${
                isActive
                  ? "bg-indigo-50 text-indigo-500"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
