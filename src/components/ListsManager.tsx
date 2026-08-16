"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { activateList } from "@/actions/lists-extra";
import { duplicateList, deleteList } from "@/actions/lists";
import { useT } from "@/i18n/LocaleProvider";
import { getItemName } from "@/lib/i18n-names";
import { formatListDate } from "@/lib/format-list-date";
import { IconEdit, IconChevronDown, IconCopy, IconTrash, IllustrationNoLists } from "@/components/Icons";

interface ListItemRow {
  id: string;
  isBought: boolean;
  quantity: number;
  unit: string;
  notes: string | null;
  item: { emoji: string; name: string; nameHe: string | null } | null;
}

interface ListRow {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  createdAt: Date;
  items: ListItemRow[];
}

export function ListsManager({ lists, nowMs }: { lists: ListRow[]; nowMs: number }) {
  const router = useRouter();
  const { t, locale } = useT();

  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  const activeList = lists.find((l) => l.status === "active");
  const otherLists = lists.filter((l) => l.id !== activeList?.id);

  async function handleStartShopping(id: string) {
    await activateList(id);
    router.push(`/lists/${id}`);
  }

  async function handleDuplicate(id: string) {
    const r = await duplicateList(id);
    if (r.ok) router.push(`/lists/${r.id}`);
  }

  async function handleDelete(id: string) {
    if (confirm(t("lists.deleteConfirm"))) {
      const r = await deleteList(id);
      if (r.ok) router.refresh();
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-semibold mb-4">{t("nav.lists")}</h1>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <IllustrationNoLists className="w-28 h-28 mb-4" />
          <h2 className="text-xl font-medium mb-2">{t("empty.noLists")}</h2>
          <p className="text-text-secondary text-center mb-6">{t("empty.noListsDesc")}</p>
          <Link
            href="/create-list"
            className="px-6 py-3 rounded-xl bg-primary text-white font-medium text-lg"
          >
            + {t("lists.create")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active list first */}
          {activeList && (
            <div className="bg-primary/5 border-2 border-primary rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-primary uppercase">{t("lists.active")}</span>
                <span className="text-xs text-text-secondary">
                  {formatListDate(new Date(activeList.createdAt).toISOString(), locale, nowMs)}
                </span>
              </div>
              <h3 className="font-medium text-lg mb-1">{activeList.name}</h3>
              <p className="text-sm text-text-secondary mb-3">
                {activeList.items.filter((li) => li.isBought).length}/{activeList.items.length} {t("lists.itemsCount")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/lists/${activeList.id}`)}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold"
                >
                  {t("lists.continueShopping")} →
                </button>
              </div>
            </div>
          )}

          {/* Other lists */}
          {otherLists.map((list) => {
            const itemCount = list.items.length;
            const statusColors: Record<string, string> = {
              draft: "bg-secondary-light text-text",
              completed: "bg-green-light text-green-dark",
            };
            const statusLabels: Record<string, string> = {
              draft: t("lists.draft"),
              completed: t("lists.completedLabel"),
            };

            return (
              <div key={list.id} className="bg-white rounded-2xl border border-neutral/20 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[list.status] || ""}`}>
                    {statusLabels[list.status] || list.status}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {formatListDate(new Date(list.createdAt).toISOString(), locale, nowMs)}
                  </span>
                </div>
                <h3 className="font-medium mb-1">{list.name}</h3>
                <button
                  onClick={() => setExpandedListId(expandedListId === list.id ? null : list.id)}
                  className="flex items-center gap-1 text-sm text-text-secondary mb-1"
                >
                  <span>
                    {itemCount} {t("lists.itemsCount")}
                  </span>
                  <IconChevronDown className={`w-4 h-4 transition-transform ${expandedListId === list.id ? "rotate-180" : ""}`} />
                </button>
                {expandedListId === list.id && list.items.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {list.items.map((li) => (
                      <div key={li.id} className={`flex items-center gap-2 text-sm ps-1 ${li.isBought ? "text-text-secondary" : "text-danger"}`}>
                        {list.status === "completed" && (
                          <span className="text-xs flex-shrink-0">{li.isBought ? "✅" : "❌"}</span>
                        )}
                        <span className="text-base">{li.item?.emoji || "🛒"}</span>
                        <span className={`truncate ${li.isBought && list.status === "completed" ? "line-through" : ""}`}>
                          {(li.item ? getItemName(li.item, locale) : null) || "?"}{" "}
                          <span className="text-xs">
                            × {li.quantity} {li.unit}
                          </span>
                        </span>
                        {li.notes && <span className="text-xs text-primary italic truncate">({li.notes})</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  {list.status === "draft" && (
                    <>
                      <button
                        onClick={() => handleStartShopping(list.id)}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm min-h-[44px]"
                      >
                        {t("lists.startShopping")}
                      </button>
                      <Link
                        href={`/edit-list/${list.id}`}
                        className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center"
                        title="Edit"
                      >
                        <IconEdit className="w-4 h-4" />
                      </Link>
                    </>
                  )}
                  {list.status === "completed" && (
                    <button
                      onClick={() => router.push(`/lists/${list.id}`)}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-neutral/30 text-text font-semibold text-sm min-h-[44px]"
                    >
                      {t("lists.view")}
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(list.id)}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-text-secondary flex items-center justify-center"
                    title="Duplicate"
                  >
                    <IconCopy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(list.id)}
                    className="w-11 h-11 rounded-xl bg-white border border-neutral/30 text-danger flex items-center justify-center"
                    title="Delete"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/create-list"
        className="fixed bottom-20 end-4 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl font-medium hover:bg-primary-light active:bg-primary-dark transition-all active:scale-90 z-20"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        +
      </Link>
    </div>
  );
}
