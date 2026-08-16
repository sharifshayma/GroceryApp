import "./globals.css";
import Script from "next/script";
import { Nunito } from "next/font/google";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = { title: "GroceryApp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
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
