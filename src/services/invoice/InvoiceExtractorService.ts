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

// ---------- Regex helpers ----------

const AMOUNT = /[€$]?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[€$]?/;
const DATE = /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/;
const DATE_LONG =
  /\d{1,2}\.\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4}/i;

function amt(prefix: string): RegExp[] {
  return [new RegExp(`(?:${prefix})[:\\s]*?(${AMOUNT.source})`, "gi")];
}

const FIELD_PATTERNS: Record<InvoiceColumnKey, RegExp[]> = {
  Rechnungsnummer: [
    /(?:rechnungs?(?:nummer|nr\.?)|invoice\s*(?:no\.?|number|#)|beleg(?:nummer|nr\.?))[:\s]*([A-Za-z0-9\-/.]+)/gi,
  ],
  Rechnungsdatum: [
    new RegExp(`(?:rechnungs?datum|invoice\\s*date|datum)[:\\s]*(${DATE.source})`, "gi"),
    new RegExp(`(?:rechnungs?datum|datum)[:\\s]*(${DATE_LONG.source})`, "gi"),
  ],
  Lieferant: [
    // Typically first prominent line — we grab text after known labels
    /(?:firma|von|from|absender|lieferant|supplier|verkäufer)[:\s]*(.+)/gi,
  ],
  "Anschrift Lieferant": [
    // Street + house number pattern
    /(\b[A-ZÄÖÜ][a-zäöüß]+(?:str(?:aße|\.)|weg|gasse|platz|allee)\s+\d+[a-z]?\b[^,\n]*(?:,\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+)?)/g,
  ],
  "USt-IdNr.": [
    /(?:ust[.-]?id(?:[-.]?nr)?\.?|vat[.\s-]?id(?:[-.]?no)?\.?)[:\s]*([A-Z]{2}\s?\d[\d\s]{6,12})/gi,
  ],
  Steuernummer: [
    /(?:steuer(?:nummer|nr\.?)|tax\s*(?:number|no\.?))[:\s]*([\d/\s]{8,15})/gi,
  ],
  Leistungsbeschreibung: [
    /(?:beschreibung|leistung|bezeichnung|description|gegenstand)[:\s]*(.{5,120})/gi,
  ],
  "Liefer-/Leistungsdatum": [
    new RegExp(
      `(?:liefer(?:datum|tag)|leistungs?datum|delivery\\s*date|liefer-?\\/\\s*leistungsdatum)[:\\s]*(${DATE.source})`,
      "gi"
    ),
    new RegExp(
      `(?:leistungszeitraum|zeitraum)[:\\s]*(${DATE.source}\\s*[-–]\\s*${DATE.source})`,
      "gi"
    ),
  ],
  Nettobetrag: amt(
    "netto(?:betrag)?|zwischensumme|summe\\s+netto|betrag\\s+(?:exkl|ohne)\\.?\\s+(?:mwst|ust)"
  ),
  Steuersatz: [/(\d{1,2}(?:[.,]\d+)?\s*%)/g],
  "MwSt.-Betrag": amt(
    "mwst|ust|mehrwertsteuer|umsatzsteuer"
  ),
  Bruttobetrag: amt(
    "gesamt(?:betrag)?|brutto(?:betrag)?|rechnungs(?:betrag|summe)|zu\\s+zahlen|zahlbetrag|total|endbetrag"
  ),
};

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

/** Extract a full UStG-compliant invoice record from raw text */
export function extractInvoiceRecord(text: string): InvoiceRecord {
  const record = {} as InvoiceRecord;
  for (const col of INVOICE_COLUMNS) {
    record[col] = firstMatch(text, FIELD_PATTERNS[col]);
  }
  return record;
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
