import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold">{t(d, "dashboard.title")}</h1>
      <p className="mt-2 text-ink/60">{t(d, "dashboard.empty")}</p>
    </div>
  );
}
