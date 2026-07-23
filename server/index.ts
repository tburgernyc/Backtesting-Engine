import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const app = express();
const port = Number(process.env.PORT || 8787);
const binanceIntervals = new Set(["1h", "4h", "1d"]);
const alpacaTimeframes: Record<string, string> = { "1h": "1Hour", "4h": "4Hour", "1d": "1Day" };

function value(input: unknown, label: string) {
  if (typeof input !== "string" || !input.trim()) throw new Error(`${label} is required.`);
  return input.trim();
}

function date(input: string, label: string) {
  const timestamp = Date.parse(input);
  if (Number.isNaN(timestamp)) throw new Error(`${label} must be a valid date.`);
  return timestamp;
}

function jsonError(error: unknown) {
  return error instanceof Error ? error.message : "Market-data request failed.";
}

async function binanceBars(symbol: string, interval: string, start: number, end: number): Promise<Candle[]> {
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error("Binance symbol must look like BTCUSDT.");
  if (!binanceIntervals.has(interval)) throw new Error("Choose 1h, 4h, or 1d for Binance.");
  const candles: Candle[] = [];
  let cursor = start;

  while (cursor < end && candles.length < 10_000) {
    const query = new URLSearchParams({ symbol, interval, startTime: String(cursor), endTime: String(end), limit: "1000" });
    const response = await fetch(`https://data-api.binance.vision/api/v3/klines?${query}`, {
      headers: process.env.BINANCE_API_KEY ? { "X-MBX-APIKEY": process.env.BINANCE_API_KEY } : undefined,
    });
    const payload: unknown = await response.json();
    if (!response.ok || !Array.isArray(payload)) throw new Error(`Binance: ${typeof payload === "object" && payload ? JSON.stringify(payload) : "could not load candles"}`);
    if (!payload.length) break;
    const rows = payload as unknown[][];
    candles.push(...rows.map((row) => ({
      timestamp: new Date(Number(row[0])).toISOString(),
      open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
    })));
    cursor = Number(rows[rows.length - 1][6]) + 1;
    if (rows.length < 1000) break;
  }

  return candles;
}

async function alpacaBars(symbol: string, interval: string, start: string, end: string): Promise<Candle[]> {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Alpaca credentials are required only when you choose Alpaca as the data source. Add ALPACA_API_KEY and ALPACA_API_SECRET to your local .env file, or choose Binance or CSV instead.");
  if (!/^[A-Z.]{1,10}$/.test(symbol)) throw new Error("Alpaca symbol must look like AAPL.");
  const timeframe = alpacaTimeframes[interval];
  if (!timeframe) throw new Error("Choose 1h, 4h, or 1d for Alpaca.");
  const query = new URLSearchParams({ timeframe, start, end, feed: process.env.ALPACA_DATA_FEED || "iex", adjustment: "all", limit: "10000", sort: "asc" });
  const response = await fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?${query}`, {
    headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret },
  });
  const payload = await response.json() as { bars?: { t: string; o: number; h: number; l: number; c: number; v: number }[]; message?: string };
  if (!response.ok || !payload.bars) throw new Error(`Alpaca: ${payload.message || "could not load candles"}`);
  return payload.bars.map((bar) => ({ timestamp: bar.t, open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v }));
}

app.get("/api/status", (_request, response) => response.json({ alpacaConfigured: Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) }));

app.get("/api/market-data", async (request, response) => {
  try {
    const provider = value(request.query.provider, "Provider");
    const symbol = value(request.query.symbol, "Symbol").toUpperCase();
    const interval = value(request.query.interval, "Timeframe");
    const start = value(request.query.start, "Start date");
    const end = value(request.query.end, "End date");
    const startMs = date(start, "Start date");
    const endMs = date(end, "End date") + 86_399_999;
    if (endMs <= startMs) throw new Error("End date must be after start date.");
    const candles = provider === "binance"
      ? await binanceBars(symbol, interval, startMs, endMs)
      : provider === "alpaca" ? await alpacaBars(symbol, interval, start, end) : (() => { throw new Error("Unsupported provider."); })();
    if (candles.length < 2) throw new Error("The provider returned too little data for a backtest.");
    response.json({ candles, source: provider, symbol, interval });
  } catch (error) {
    response.status(400).json({ error: jsonError(error) });
  }
});

const directory = fileURLToPath(new URL("..", import.meta.url));
const dist = join(directory, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_request, response) => response.sendFile(join(dist, "index.html")));
}

app.listen(port, () => console.log(`Research Desk API listening on http://localhost:${port}`));
