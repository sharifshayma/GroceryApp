import "./globals.css";
import Script from "next/script";
import { Nunito } from "next/font/google";
import { getCurrentUser } from "@/lib/auth-guard";
import { dirFor, type Locale } from "@/i18n";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = { title: "GroceryApp" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const locale: Locale = user?.language ?? "en";

  return (
    <html lang={locale} dir={dirFor(locale)} className={nunito.variable}>
      <body>
        {children}
        <Script
          src="https://umami-iota-six-97.vercel.app/script.js"
          data-website-id="d5b8429d-dc94-449c-b434-9934a2139ad8"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
