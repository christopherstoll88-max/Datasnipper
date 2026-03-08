import { OcrBlock } from "@/models/OcrResult";
import { parse, isValid } from "date-fns";

const DATE_FORMATS = [
  "dd.MM.yyyy",
  "d.M.yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "dd.MM.yy",
  "d MMM yyyy",
  "dd MMM yyyy",
  "MMMM d, yyyy",
];

export interface ExtractedDate {
  raw: string;
  date: Date;
  formatted: string;
  blockIndex: number;
}

const DATE_REGEX = /\b(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})\b/g;

export function extractDates(blocks: OcrBlock[]): ExtractedDate[] {
  const results: ExtractedDate[] = [];

  blocks.forEach((block, i) => {
    const matches = [...block.text.matchAll(DATE_REGEX)];
    for (const match of matches) {
      const raw = match[0];
      for (const fmt of DATE_FORMATS) {
        try {
          const date = parse(raw, fmt, new Date());
          if (isValid(date) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
            results.push({
              raw,
              date,
              formatted: date.toISOString().split("T")[0],
              blockIndex: i,
            });
            break;
          }
        } catch {
          continue;
        }
      }
    }
  });

  return results;
}
