/** All fields required by §14 UStG for proper invoice bookkeeping */
export const INVOICE_COLUMNS = [
  "Rechnungsnummer",
  "Rechnungsdatum",
  "Lieferant",
  "Anschrift Lieferant",
  "USt-IdNr.",
  "Steuernummer",
  "Leistungsbeschreibung",
  "Liefer-/Leistungsdatum",
  "Nettobetrag",
  "Steuersatz",
  "MwSt.-Betrag",
  "Bruttobetrag",
] as const;

export type InvoiceColumnKey = (typeof INVOICE_COLUMNS)[number];
export type InvoiceRecord = Record<InvoiceColumnKey, string>;

// ---------- Normalization ----------

/** Normalize a raw text string: collapse whitespace, unify quotes, trim */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Parse a German/international amount string to a canonical "1.234,56" form */
function normalizeAmount(raw: string): string {
  const cleaned = raw.replace(/\s/g, "").replace(/[€$£]/g, "").trim();
  // 1.234,56 → keep as-is (German)
  if (/^\d{1,3}(\.\d{3})*(,\d{2})$/.test(cleaned)) return cleaned;
  // 1,234.56 → convert to German
  if (/^\d{1,3}(,\d{3})*(\.\d{2})$/.test(cleaned)) {
    return cleaned.replace(/,/g, "X").replace(/\./g, ",").replace(/X/g, ".");
  }
  // 1234.56 → 1.234,56
  if (/^\d+\.\d{2}$/.test(cleaned)) {
    const [int, dec] = cleaned.split(".");
    return Number(int).toLocaleString("de-DE") + "," + dec;
  }
  // 1234,56 → keep
  if (/^\d+,\d{2}$/.test(cleaned)) return cleaned;
  return raw.trim();
}

// ---------- Pattern helpers ----------

const AMT_CORE =
  /[€$£]?\s*\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s*[€$£]?/;

const DATE_SHORT = /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/;
const DATE_LONG =
  /\d{1,2}\.\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4}/i;
const DATE_ANY = new RegExp(
  `(?:${DATE_LONG.source}|${DATE_SHORT.source})`
);

const PCT = /\d{1,2}(?:[.,]\d+)?\s*%/;

// ---------- Line-based context search ----------

/**
 * Search lines for a field label, then capture either:
 *   • a match group 1 on the same line, OR
 *   • the next non-empty line (optionally filtered by valuePattern)
 */
function findByLabel(
  lines: string[],
  labelPatterns: RegExp[],
  valuePattern?: RegExp
): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of labelPatterns) {
      const flags = [...new Set(pat.flags.replace("g", "").split("").concat("i"))].join("");
      const re = new RegExp(pat.source, flags);
      const m = re.exec(line);
      if (!m) continue;

      // Value captured inline (group 1)
      if (m[1]?.trim()) return m[1].trim();

      // Value on next line
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (valuePattern) {
          const vm = valuePattern.exec(next);
          if (vm) return (vm[1] ?? vm[0]).trim();
        } else {
          return next;
        }
      }
    }
  }
  return "";
}

/** Find first regex match across all lines */
function findFirst(lines: string[], pattern: RegExp): string {
  for (const line of lines) {
    const flags = [...new Set(pattern.flags.replace("g", "").split("").concat("i"))].join("");
    const re = new RegExp(pattern.source, flags);
    const m = re.exec(line);
    if (m) return (m[1] ?? m[0]).trim();
  }
  return "";
}

/** Find ALL amount matches in a line, returning raw strings */
function amountsInLine(line: string): string[] {
  const re = new RegExp(AMT_CORE.source, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    results.push(m[0].trim());
  }
  return results;
}

/** Parse an amount string to a float for comparison */
function toFloat(s: string): number {
  // German: 1.234,56
  const g = s.replace(/[€$£\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(g) || 0;
}

// ---------- Field extractors ----------

function extractRechnungsnummer(lines: string[]): string {
  return findByLabel(lines, [
    /(?:rechnungs?(?:nummer|nr\.?|no\.?)|invoice\s*(?:no\.?|number|#)|beleg(?:nummer|nr\.?))[:\s#]*([A-Za-z0-9][\w\-./]{1,30})/i,
    /\b(RE[-\s]?\d[\w\-./]{2,20})\b/i,
    /\b(INV[-\s]?\d[\w\-./]{2,20})\b/i,
  ]);
}

function extractRechnungsdatum(lines: string[]): string {
  return findByLabel(
    lines,
    [
      /(?:rechnungs?datum|invoice\s*date|ausgestellt\s+am|datum)[:\s]*/i,
    ],
    DATE_ANY
  ) || findFirst(lines, new RegExp(`(?:vom|am|date)[:\\s]*(${DATE_ANY.source})`, "i"))
    || findFirst(lines, DATE_ANY);
}

function extractLieferant(lines: string[]): string {
  // Try explicit label first
  const byLabel = findByLabel(lines, [
    /(?:firma|von|from|absender|lieferant|supplier|verkäufer|rechnungssteller)[:\s]+(.+)/i,
  ]);
  if (byLabel) return byLabel;

  // Heuristic: find first line that looks like a company name
  // (contains GmbH, AG, KG, e.K., GbR, etc., or is capitalized and not a date/amount)
  const companyRe =
    /\b(?:GmbH|AG|KG|OHG|GbR|e\.?K\.?|UG|SE|Verlag|Ltd|Inc|Corp|S\.?A\.?)\b/i;
  for (const line of lines.slice(0, 20)) {
    const l = normalize(line);
    if (companyRe.test(l)) return l;
  }

  // Fallback: first non-empty, non-numeric, non-short line in top 10
  for (const line of lines.slice(0, 10)) {
    const l = normalize(line);
    if (l.length > 5 && !/^\d/.test(l) && !DATE_ANY.test(l)) return l;
  }
  return "";
}

function extractAnschrift(lines: string[]): string {
  // German street address pattern
  const streetRe =
    /\b[A-ZÄÖÜ][a-zäöüß]+(?:str(?:aße|\.)|weg|gasse|platz|allee|ring|damm|chaussee)\s+\d+[a-z]?\b/i;
  const zipCityRe = /\b\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]+/;

  for (let i = 0; i < lines.length; i++) {
    if (streetRe.test(lines[i])) {
      let addr = normalize(lines[i]);
      // Append zip+city if on next line
      if (i + 1 < lines.length && zipCityRe.test(lines[i + 1])) {
        addr += ", " + normalize(lines[i + 1]);
      }
      return addr;
    }
  }
  // Fallback: zip+city alone
  return findFirst(lines, zipCityRe);
}

function extractUstIdNr(lines: string[]): string {
  return findByLabel(
    lines,
    [/(?:ust[.-]?id(?:[-.]?nr)?\.?|vat[.\s-]?id(?:[-.]?no)?\.?)[:\s]*/i],
    /([A-Z]{2}\s?[\d\s]{6,12})/i
  ) || findFirst(lines, /\b(DE\s?\d{9})\b/i);
}

function extractSteuernummer(lines: string[]): string {
  return findByLabel(
    lines,
    [/(?:steuer(?:nummer|nr\.?)|tax\s*(?:number|no\.?))[:\s]*/i],
    /([\d/\s]{8,20})/
  );
}

function extractLeistungsbeschreibung(lines: string[]): string {
  return findByLabel(lines, [
    /(?:beschreibung|leistung(?:sart)?|bezeichnung|description|gegenstand|betreff|betr\.)[:\s]*(.{5,100})/i,
  ]);
}

function extractLieferdatum(lines: string[]): string {
  return findByLabel(
    lines,
    [
      /(?:liefer(?:datum|tag|zeitraum)|leistungs?datum|delivery\s*date|liefer-?\/?[\s]*leistungsdatum|leistungszeitraum|zeitraum)[:\s]*/i,
    ],
    DATE_ANY
  );
}

// ---------- Amount extraction (the hard part) ----------

interface FoundAmount {
  line: string;
  lineIdx: number;
  raw: string;
  value: number;
  /** Context words on the same line (lowercased) */
  context: string;
}

function findAllAmounts(lines: string[]): FoundAmount[] {
  const results: FoundAmount[] = [];
  lines.forEach((line, lineIdx) => {
    const amounts = amountsInLine(line);
    amounts.forEach((raw) => {
      results.push({
        line,
        lineIdx,
        raw,
        value: toFloat(raw),
        context: line.toLowerCase(),
      });
    });
  });
  return results;
}

const BRUTTO_KEYWORDS =
  /gesamt(?:betrag)?|brutto(?:betrag)?|rechnungs(?:betrag|summe)|zu\s+zahlen|zahlbetrag|total|endbetrag|fällig|fälligkeit/i;
const NETTO_KEYWORDS =
  /netto(?:betrag)?|zwischensumme|summe\s+netto|betrag\s+(?:exkl|ohne)\.?\s+(?:mwst|ust)|netto\s+gesamt/i;
const MWST_KEYWORDS =
  /mwst|ust\.|mehrwertsteuer|umsatzsteuer|tax\s+amount/i;

function extractAmounts(lines: string[]): {
  netto: string;
  mwst: string;
  brutto: string;
  steuersatz: string;
} {
  const amounts = findAllAmounts(lines);

  // --- Steuersatz: find a % on any line that mentions tax ---
  let steuersatz = "";
  for (const line of lines) {
    const lc = line.toLowerCase();
    if (MWST_KEYWORDS.test(lc) || /steuersatz|tax\s*rate/i.test(lc)) {
      const pm = PCT.exec(line);
      if (pm) { steuersatz = pm[0].trim(); break; }
    }
  }
  if (!steuersatz) {
    // Try any line that only contains a percentage (e.g. "19 %")
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d{1,2}\s*%$/.test(trimmed)) { steuersatz = trimmed; break; }
    }
  }

  // --- Explicit label matching for amounts ---
  let brutto = "", netto = "", mwst = "";

  for (const a of amounts) {
    if (!brutto && BRUTTO_KEYWORDS.test(a.context)) brutto = a.raw;
    if (!netto && NETTO_KEYWORDS.test(a.context)) netto = a.raw;
    if (!mwst && MWST_KEYWORDS.test(a.context)) mwst = a.raw;
  }

  // --- Heuristic fallback: if we found ≥2 amounts try to derive missing ones ---
  // Sort all distinct values desc
  const distinctVals = [...new Set(amounts.map((a) => a.value))].sort(
    (a, b) => b - a
  );

  if (!brutto && distinctVals.length > 0) {
    // Brutto is typically the largest amount on the invoice
    brutto = amounts.find((a) => a.value === distinctVals[0])?.raw ?? "";
  }

  if (!netto && !mwst && distinctVals.length >= 3) {
    // brutto = largest, netto = second largest, mwst = third (or brutto - netto)
    netto = amounts.find((a) => a.value === distinctVals[1])?.raw ?? "";
    mwst = amounts.find((a) => a.value === distinctVals[2])?.raw ?? "";
  } else if (!netto && mwst && brutto) {
    const nettoVal = toFloat(brutto) - toFloat(mwst);
    if (nettoVal > 0) netto = nettoVal.toLocaleString("de-DE", { minimumFractionDigits: 2 });
  } else if (!mwst && netto && brutto) {
    const mwstVal = toFloat(brutto) - toFloat(netto);
    if (mwstVal > 0) mwst = mwstVal.toLocaleString("de-DE", { minimumFractionDigits: 2 });
  }

  return {
    netto: netto ? normalizeAmount(netto) : "",
    mwst: mwst ? normalizeAmount(mwst) : "",
    brutto: brutto ? normalizeAmount(brutto) : "",
    steuersatz,
  };
}

// ---------- Public API ----------

/** Extract a full UStG-compliant invoice record from an array of text lines */
export function extractInvoiceRecordFromLines(lines: string[]): InvoiceRecord {
  const amounts = extractAmounts(lines);
  return {
    Rechnungsnummer: extractRechnungsnummer(lines),
    Rechnungsdatum: extractRechnungsdatum(lines),
    Lieferant: extractLieferant(lines),
    "Anschrift Lieferant": extractAnschrift(lines),
    "USt-IdNr.": extractUstIdNr(lines),
    Steuernummer: extractSteuernummer(lines),
    Leistungsbeschreibung: extractLeistungsbeschreibung(lines),
    "Liefer-/Leistungsdatum": extractLieferdatum(lines),
    Nettobetrag: amounts.netto,
    Steuersatz: amounts.steuersatz,
    "MwSt.-Betrag": amounts.mwst,
    Bruttobetrag: amounts.brutto,
  };
}

/** Extract a full UStG-compliant invoice record from raw flat text (legacy) */
export function extractInvoiceRecord(text: string): InvoiceRecord {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return extractInvoiceRecordFromLines(lines);
}

// Keep legacy interface for the small extraction panel
export interface InvoiceField {
  key: string;
  label: string;
  value: string | null;
}

export function extractInvoiceFields(text: string): InvoiceField[] {
  const record = extractInvoiceRecord(text);
  return INVOICE_COLUMNS.map((col) => ({
    key: col,
    label: col,
    value: record[col] || null,
  }));
}
