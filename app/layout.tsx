import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

/**
 * Fonts are self-hosted by `next/font`: downloaded at build time and served from
 * this origin. No request to Google at runtime, which keeps `connect-src 'self'`
 * honest and removes a third party from the critical render path.
 *
 * `display: "swap"` so text is readable before the font arrives — on an Indian
 * mobile connection that difference is seconds, not milliseconds.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shubh — celebration planning where the numbers actually add up",
  description:
    "Plan an Indian wedding, birthday, griha pravesh or community event with a budget that " +
    "balances to the rupee, a schedule computed backwards from the date, and an AI explanation " +
    "whose every figure is checked against the plan before you see it.",
  applicationName: "Shubh",
  keywords: [
    "wedding budget planner India",
    "event planning",
    "griha pravesh",
    "birthday party budget",
    "community event planning",
  ],
  authors: [{ name: "Shubh" }],
  openGraph: {
    title: "Shubh — celebration planning where the numbers actually add up",
    description:
      "Budgets that balance to the rupee, schedules computed backwards from the date, and every " +
      "AI-stated figure verified against the plan.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom is not capped. Capping it is a common and avoidable accessibility
  // failure, and this page has numbers people will want to magnify.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf2" },
    { media: "(prefers-color-scheme: dark)", color: "#17120e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className={`${inter.variable} ${lora.variable}`}>
        {/* First focusable element on the page, so a keyboard or screen-reader
            user can skip the header and the form and land on the plan. */}
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
