export type CsvRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string[]> = {
  vin: ["vin", "vehicleidentificationnumber", "vehicle_id", "vehiclevin"],
  stockNumber: ["stock", "stocknumber", "stockno", "stock#", "stk", "stock_number"],
  year: ["year", "yr", "modelyear"],
  make: ["make", "brand"],
  model: ["model"],
  color: ["color", "colour", "extcolor", "exteriorcolor"],
  location: ["location", "lot", "lotname", "lotlocation", "expectedlocation", "storagelocation"],
};

function normHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#]/g, "");
}

function mapHeaders(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  const normalized = headers.map(normHeader);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = normalized.findIndex((h) => aliases.includes(h));
    if (i >= 0) index[field] = i;
  }
  return index;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

export type ParsedVehicle = {
  vin: string;
  stockNumber: string;
  year: string;
  make: string;
  model: string;
  color: string;
  location: string;
};

export function parseInventoryCsv(text: string): {
  vehicles: ParsedVehicle[];
  skipped: number;
  error: string | null;
} {
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) return { vehicles: [], skipped: 0, error: "CSV is empty." };
  const map = mapHeaders(headers);
  if (map.vin === undefined) {
    return {
      vehicles: [],
      skipped: 0,
      error:
        "Could not find a VIN column on this DMS Master List. Use headers like VIN, Stock, Year, Make, Model, Color, Location.",
    };
  }
  const vehicles: ParsedVehicle[] = [];
  let skipped = 0;
  for (const row of rows) {
    const vin = (row[map.vin] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (vin.length < 11) {
      skipped += 1;
      continue;
    }
    vehicles.push({
      vin,
      stockNumber: map.stockNumber !== undefined ? row[map.stockNumber] ?? "" : "",
      year: map.year !== undefined ? row[map.year] ?? "" : "",
      make: map.make !== undefined ? row[map.make] ?? "" : "",
      model: map.model !== undefined ? row[map.model] ?? "" : "",
      color: map.color !== undefined ? row[map.color] ?? "" : "",
      location: map.location !== undefined ? row[map.location] ?? "" : "",
    });
  }
  return { vehicles, skipped, error: null };
}
