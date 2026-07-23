import type { Candle } from "./backtest";

export type Provider = "binance" | "alpaca";

export async function loadMarketData(request: { provider: Provider; symbol: string; interval: string; start: string; end: string }) {
  const query = new URLSearchParams(request);
  const response = await fetch(`/api/market-data?${query}`);
  const payload = await response.json() as { candles?: Candle[]; error?: string };
  if (!response.ok || !payload.candles) throw new Error(payload.error || "Could not load market data.");
  return payload.candles;
}

export async function parseCsv(file: File): Promise<Candle[]> {
  const [header, ...rows] = (await file.text()).trim().split(/\r?\n/);
  const columns = header.split(",").map((column) => column.trim().toLowerCase());
  const index = (names: string[]) => names.map((name) => columns.indexOf(name)).find((value) => value >= 0) ?? -1;
  const timestamp = index(["timestamp", "date", "time"]);
  const close = index(["close", "c"]);
  if (timestamp < 0 || close < 0) throw new Error("CSV needs timestamp (or date) and close columns.");
  const open = index(["open", "o"]);
  const high = index(["high", "h"]);
  const low = index(["low", "l"]);
  const volume = index(["volume", "v"]);
  const value = (cells: string[], position: number, fallback: number) => position >= 0 ? Number(cells[position]) : fallback;
  const candles = rows.flatMap((row) => {
    const cells = row.split(",").map((cell) => cell.trim());
    const closing = Number(cells[close]);
    const parsedTimestamp = new Date(cells[timestamp]);
    if (Number.isNaN(parsedTimestamp.valueOf()) || !Number.isFinite(closing)) return [];
    return [{ timestamp: parsedTimestamp.toISOString(), open: value(cells, open, closing), high: value(cells, high, closing), low: value(cells, low, closing), close: closing, volume: value(cells, volume, 0) }];
  });
  if (candles.length < 2) throw new Error("CSV needs at least two valid rows.");
  return candles.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
