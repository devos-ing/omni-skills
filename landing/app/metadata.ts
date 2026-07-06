import type { Metadata } from "next";

const canonicalUrl = "https://github.com/0xroylee/getsuperpower";
const title = "GetSuperpower - Install AI Agent Workflows as Callable Skills";
const description =
  "Install complete AI-agent workflows as callable skills with one GetSuperpower command.";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl),
  alternates: {
    canonical: "/",
  },
  applicationName: "GetSuperpower",
  title,
  description,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    siteName: "GetSuperpower",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};
