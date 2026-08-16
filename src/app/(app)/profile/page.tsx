import { LanguageToggle } from "@/components/LanguageToggle";

export default function ProfilePage() {
  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="mt-4"><LanguageToggle /></div>
      <p className="mt-4 text-text-secondary">Profile screen coming in M5.</p>
    </div>
  );
}
