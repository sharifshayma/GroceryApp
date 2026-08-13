import type { en } from "./en";

export const he: typeof en = {
  common: { greeting: "שלום, {name}", save: "שמור", saving: "שומר...", loading: "טוען..." },
  auth: {
    login: { title: "התחברות", email: "אימייל", password: "סיסמה", submit: "התחבר", noAccount: "אין לך חשבון? הרשמה" },
    signup: { title: "יצירת חשבון", name: "השם שלך", submit: "הרשמה", haveAccount: "כבר יש לך חשבון? התחבר" },
    reset: { title: "איפוס סיסמה", sendCode: "שלח קוד", code: "קוד", newPassword: "סיסמה חדשה", submit: "אפס" },
    logout: "התנתקות",
  },
  onboarding: {
    title: "הגדרת משק הבית",
    create: { heading: "יצירת משק בית", name: "שם משק הבית", submit: "צור" },
    join: { heading: "הצטרפות למשק בית", code: "קוד הזמנה", submit: "הצטרף" },
  },
  dashboard: { title: "לוח בקרה", empty: "משק הבית שלך מוגדר. תכונות הקניות בדרך." },
};
