"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import {
  IconHome, IconHomeFilled, IconLists, IconListsFilled,
  IconStock, IconStockFilled, IconProfile, IconProfileFilled,
} from "@/components/Icons";

type Tab = { path: string; key: "home" | "lists" | "stock" | "profile"; icon: (a: boolean) => React.ReactNode };

const tabs: Tab[] = [
  { path: "/", key: "home", icon: (a) => (a ? <IconHomeFilled /> : <IconHome />) },
  { path: "/lists", key: "lists", icon: (a) => (a ? <IconListsFilled /> : <IconLists />) },
  { path: "/stock", key: "stock", icon: (a) => (a ? <IconStockFilled /> : <IconStock />) },
  { path: "/profile", key: "profile", icon: (a) => (a ? <IconProfileFilled /> : <IconProfile />) },
];

export function TabBar({ lowStockCount }: { lowStockCount: number }) {
  const pathname = usePathname();
  const { t } = useT();
  const { isKeyboardVisible } = useKeyboardVisible();
  if (isKeyboardVisible) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-surface border-t border-neutral z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/"
              ? pathname === "/" || pathname.startsWith("/category")
              : pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 transition-colors ${
                isActive ? "text-primary" : "text-text-secondary"
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {tab.key === "stock" && lowStockCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-medium flex items-center justify-center">
                    {lowStockCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{t(`nav.${tab.key}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
