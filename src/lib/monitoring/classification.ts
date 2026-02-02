export type TransferClassification =
  | "EXCHANGE_DEPOSIT"
  | "EXCHANGE_WITHDRAWAL"
  | "EXCHANGE_TO_EXCHANGE"
  | "TRANSFER";

export type ClassifyTransferInput = {
  fromExchange: string | null;
  toExchange: string | null;
};

/**
 * Classify a transfer based on the exchange labels of sender and recipient.
 */
export function classifyTransfer({
  fromExchange,
  toExchange,
}: ClassifyTransferInput): TransferClassification {
  const isFromExchange = fromExchange !== null;
  const isToExchange = toExchange !== null;

  if (isFromExchange && isToExchange) {
    return "EXCHANGE_TO_EXCHANGE";
  }

  if (isToExchange) {
    return "EXCHANGE_DEPOSIT";
  }

  if (isFromExchange) {
    return "EXCHANGE_WITHDRAWAL";
  }

  return "TRANSFER";
}
