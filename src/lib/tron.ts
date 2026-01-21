import TronWebPkg from "tronweb";

export const TRONGRID_FULLHOST = "https://api.trongrid.io";
export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export type OnChainBlacklistResult =
  | {
      ok: true;
      blacklisted: boolean;
      evidence: {
        contractAddress: string;
        method: "getBlackListStatus" | "isBlackListed";
        raw: string;
        fullHost: string;
      };
    }
  | { ok: false; blacklisted: false; error: string };

type TronWebCtor = new (options: { fullHost: string; headers?: Record<string, string> }) => {
  setAddress: (address: string) => void;
  contract: () => { at: (address: string) => Promise<unknown> };
};

const tronWebModule = TronWebPkg as unknown as { TronWeb?: unknown; default?: unknown };
const TronWeb = (tronWebModule.TronWeb || tronWebModule.default || TronWebPkg) as unknown as TronWebCtor;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function createTronWeb(fullHost = TRONGRID_FULLHOST) {
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  return new TronWeb({
    fullHost,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
  });
}

function normalizeBooleanResult(res: unknown): { raw: string; blacklisted: boolean } {
  const raw =
    typeof res === "string"
      ? res
      : typeof res === "number"
        ? String(res)
        : typeof res === "boolean"
          ? res
            ? "1"
            : "0"
          : res &&
              typeof res === "object" &&
              "toString" in res &&
              typeof (res as { toString: () => string }).toString === "function"
            ? (res as { toString: () => string }).toString()
            : String(res);

  const blacklisted = res === true || raw === "1";
  return { raw, blacklisted };
}

export async function readUsdtBlacklistStatusOnChain(
  address: string,
  options?: { timeoutMs?: number; fullHost?: string },
): Promise<OnChainBlacklistResult> {
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const fullHost = options?.fullHost ?? TRONGRID_FULLHOST;

  try {
    const tronWeb = createTronWeb(fullHost);
    tronWeb.setAddress(address);

    const contract = await withTimeout(
      tronWeb.contract().at(USDT_TRC20_CONTRACT),
      timeoutMs,
      "TronGrid contract init",
    );

    type TronContractMethod = (addr: string) => { call: () => Promise<unknown> };
    const contractObj = contract as Record<string, unknown>;

    const getBlackListStatus = contractObj["getBlackListStatus"];
    if (typeof getBlackListStatus === "function") {
      const res = await withTimeout(
        (getBlackListStatus as TronContractMethod)(address).call(),
        timeoutMs,
        "On-chain read",
      );
      const { raw, blacklisted } = normalizeBooleanResult(res);
      return {
        ok: true,
        blacklisted,
        evidence: {
          contractAddress: USDT_TRC20_CONTRACT,
          method: "getBlackListStatus",
          raw,
          fullHost,
        },
      };
    }

    const isBlackListed = contractObj["isBlackListed"];
    if (typeof isBlackListed === "function") {
      const res = await withTimeout(
        (isBlackListed as TronContractMethod)(address).call(),
        timeoutMs,
        "On-chain read",
      );
      const { raw, blacklisted } = normalizeBooleanResult(res);
      return {
        ok: true,
        blacklisted,
        evidence: {
          contractAddress: USDT_TRC20_CONTRACT,
          method: "isBlackListed",
          raw,
          fullHost,
        },
      };
    }

    return {
      ok: false,
      blacklisted: false,
      error: "Blacklist getter not found in contract ABI.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown TronGrid/TronWeb error.";
    return { ok: false, blacklisted: false, error: message };
  }
}
