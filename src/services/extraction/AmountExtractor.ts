import { OcrBlock } from "@/models/OcrResult";

const AMOUNT_PATTERNS = [
  // EUR/USD/GBP with thousands separator
  /([€$£])\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/,
  // Negative in parentheses: (1.234,56)
  /\(([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\)/,
  // Plain decimal number (at least 2 decimal places)
  /[-]?[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}/,
];

export interface ExtractedAmount {
  raw: string;
  value: number;
  currency?: string;
  negative: boolean;
  blockIndex: number;
}

export function extractAmounts(blocks: OcrBlock[]): ExtractedAmount[] {
  const results: ExtractedAmount[] = [];

  blocks.forEach((block, i) => {
    const text = block.text;

    // Check parentheses (negative)
    const parenMatch = text.match(/\(([\d.,]+)\)/);
    if (parenMatch) {
      const value = parseAmount(parenMatch[1]);
      if (!isNaN(value)) {
        results.push({ raw: parenMatch[0], value: -value, negative: true, blockIndex: i });
        return;
      }
    }

    for (const pattern of AMOUNT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const raw = match[0];
        const currency = match[1]?.match(/[€$£]/) ? match[1] : undefined;
        const numStr = match[2] ?? match[0];
        const value = parseAmount(numStr);
        if (!isNaN(value) && value >= 0) {
          results.push({ raw, value, currency, negative: raw.startsWith("-"), blockIndex: i });
        }
        break;
      }
    }
  });

  return results;
}

function parseAmount(str: string): number {
  // Handle German format: 1.234,56 → 1234.56
  if (str.match(/\d+\.\d{3},\d{2}/)) {
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
  }
  // Handle English format: 1,234.56 → 1234.56
  if (str.match(/\d+,\d{3}\.\d{2}/)) {
    return parseFloat(str.replace(/,/g, ""));
  }
  // Plain with comma decimal: 1234,56
  if (str.match(/^\d+,\d{2}$/)) {
    return parseFloat(str.replace(",", "."));
  }
  return parseFloat(str.replace(/[^0-9.]/g, ""));
}
