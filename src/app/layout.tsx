import "./globals.css";

import Script from "next/script";
export const metadata = { title: "GroceryApp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}        <Script
          src="https://umami-iota-six-97.vercel.app/script.js"
          data-website-id="d5b8429d-dc94-449c-b434-9934a2139ad8"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
