export interface InvoiceField {
  key: "brutto" | "netto" | "mwst" | "datum";
  label: string;
  value: string | null;
}

const PATTERNS: Record<InvoiceField["key"], RegExp[]> = {
  brutto: [
    /(?:gesamt(?:betrag)?|brutto(?:betrag)?|rechnungs(?:betrag|summe)|zu\s+zahlen|zahlbetrag|total)[:\s]*([€$]?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[€$]?)/gi,
  ],
  netto: [
    /(?:netto(?:betrag)?|zwischensumme|summe\s+netto|betrag\s+(?:exkl|ohne)\.?\s+(?:mwst|ust))[:\s]*([€$]?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[€$]?)/gi,
  ],
  mwst: [
    /(?:mwst|ust|mehrwertsteuer|umsatzsteuer)(?:[\s(]+\d+[\s,]+%)?[:\s]*([€$]?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[€$]?)/gi,
  ],
  datum: [
    /(?:rechnungs(?:datum|datum)|datum|ausgestellt\s+am)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/gi,
    /(\d{1,2}\.\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/gi,
  ],
};

const LABELS: Record<InvoiceField["key"], string> = {
  brutto: "Bruttobetrag",
  netto: "Nettobetrag",
  mwst: "MwSt.-Betrag",
  datum: "Rechnungsdatum",
};

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function extractInvoiceFields(text: string): InvoiceField[] {
  return (Object.keys(PATTERNS) as InvoiceField["key"][]).map((key) => ({
    key,
    label: LABELS[key],
    value: firstMatch(text, PATTERNS[key]),
  }));
}
