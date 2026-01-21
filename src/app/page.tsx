import { BlacklistChecker } from "@/components/blacklist-checker";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What does “blacklisted” mean for USDT on TRON?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The USDT smart contract can restrict addresses. If an address is blacklisted, USDT transfers from that address will likely revert on-chain.",
        },
      },
      {
        "@type": "Question",
        name: "Do you need my private key or seed phrase?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. This checker only needs a public TRON address. Never share your seed phrase or private keys.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlacklistChecker />
    </>
  );
}
