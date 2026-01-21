// check-usdt-blacklist.js
// Usage: node check-usdt-blacklist.js <TRON_ADDRESS>

/* eslint-disable @typescript-eslint/no-require-imports */

// tronweb export shape can vary by version
const TronWebPkg = require("tronweb");
const TronWeb = TronWebPkg.TronWeb || TronWebPkg.default || TronWebPkg;

const FULLNODE = "https://api.trongrid.io";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const addr = process.argv[2];
if (!addr) {
  console.log("Usage: node check-usdt-blacklist.js <TRON_ADDRESS>");
  process.exit(1);
}

const tronWeb = new TronWeb({ fullHost: FULLNODE });

// Required by TronWeb / nodes as "owner_address" (caller), even for read-only calls
tronWeb.setAddress(addr);

async function main() {
  const usdt = await tronWeb.contract().at(USDT_CONTRACT);

  // USDT contracts commonly expose one of these getters
  let res;
  if (typeof usdt.getBlackListStatus === "function") {
    res = await usdt.getBlackListStatus(addr).call();
  } else if (typeof usdt.isBlackListed === "function") {
    res = await usdt.isBlackListed(addr).call();
  } else {
    throw new Error("Blacklist getter not found in ABI (expected getBlackListStatus or isBlackListed).");
  }

  const raw = res?.toString?.() ?? res;
  const blacklisted = res === true || raw === "1";

  console.log(JSON.stringify({ address: addr, blacklisted, raw }, null, 2));
}

main().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(2);
});
