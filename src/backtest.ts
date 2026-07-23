export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const strategies = {
  "sma-crossover": { label: "Moving-average crossover", description: "Trend following: buy a bullish cross, sell a bearish cross." },
  "rsi-reversion": { label: "RSI mean reversion", description: "Buy an oversold RSI reading and exit after it recovers." },
  "buy-and-hold": { label: "Buy and hold", description: "A baseline: buy at the first candle and hold until the last." },
} as const;

export type StrategyId = keyof typeof strategies;

export type Settings = {
  strategy: StrategyId;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  rsiEntry: number;
  rsiExit: number;
  startingCash: number;
  feePercent: number;
};

export type Trade = {
  timestamp: string;
  side: "Buy" | "Sell";
  price: number;
  returnPercent?: number;
  profitLoss?: number;
};

export type BacktestResult = {
  strategy: StrategyId;
  equity: { date: string; value: number }[];
  trades: Trade[];
  netReturn: number;
  netProfit: number;
  maxDrawdown: number;
  winRate: number | null;
  profitFactor: number | null;
  closedTradeCount: number;
  averageTradeReturn: number | null;
  peakEquity: number;
  lowestEquity: number;
  startingCash: number;
  timeInMarket: number;
  endingCash: number;
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function rsi(candles: Candle[], index: number, period: number) {
  if (index < period) return null;
  const changes = candles.slice(index - period, index + 1).map((candle, changeIndex, series) => changeIndex ? candle.close - series[changeIndex - 1].close : 0).slice(1);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.abs(Math.min(change, 0)));
  const averageLoss = average(losses);
  return averageLoss === 0 ? 100 : 100 - 100 / (1 + average(gains) / averageLoss);
}

export function runBacktest(candles: Candle[], settings: Settings): BacktestResult {
  if (settings.strategy === "sma-crossover" && settings.fastPeriod >= settings.slowPeriod) {
    throw new Error("The fast moving average must be smaller than the slow moving average.");
  }

  let cash = settings.startingCash;
  let units = 0;
  let entryValue = 0;
  const fee = settings.feePercent / 100;
  const trades: Trade[] = [];
  const equity: { date: string; value: number }[] = [];
  let barsInMarket = 0;
  let previousFast: number | null = null;
  let previousSlow: number | null = null;

  candles.forEach((candle, index) => {
    let shouldBuy = settings.strategy === "buy-and-hold" && index === 0;
    let shouldSell = false;

    if (settings.strategy === "sma-crossover" && index >= settings.slowPeriod - 1) {
      const fast = average(candles.slice(index - settings.fastPeriod + 1, index + 1).map((item) => item.close));
      const slow = average(candles.slice(index - settings.slowPeriod + 1, index + 1).map((item) => item.close));
      const crossedAbove = previousFast !== null && previousSlow !== null && previousFast <= previousSlow && fast > slow;
      const crossedBelow = previousFast !== null && previousSlow !== null && previousFast >= previousSlow && fast < slow;

      shouldBuy = crossedAbove;
      shouldSell = crossedBelow;
      previousFast = fast;
      previousSlow = slow;
    }

    if (settings.strategy === "rsi-reversion") {
      const value = rsi(candles, index, settings.rsiPeriod);
      shouldBuy = value !== null && value <= settings.rsiEntry;
      shouldSell = value !== null && value >= settings.rsiExit;
    }

    if (shouldBuy && units === 0) {
      units = (cash * (1 - fee)) / candle.close;
      entryValue = cash;
      cash = 0;
      trades.push({ timestamp: candle.timestamp, side: "Buy", price: candle.close });
    }

    if (shouldSell && units > 0) {
      cash = units * candle.close * (1 - fee);
      trades.push({ timestamp: candle.timestamp, side: "Sell", price: candle.close, returnPercent: (cash / entryValue - 1) * 100, profitLoss: cash - entryValue });
      units = 0;
    }

    if (units > 0) barsInMarket += 1;
    equity.push({ date: candle.timestamp, value: cash + units * candle.close });
  });

  // Close any open position at the final candle so each run has a realized result.
  if (units > 0) {
    const last = candles[candles.length - 1];
    cash = units * last.close * (1 - fee);
    trades.push({ timestamp: last.timestamp, side: "Sell", price: last.close, returnPercent: (cash / entryValue - 1) * 100, profitLoss: cash - entryValue });
    equity[equity.length - 1] = { date: last.timestamp, value: cash };
  }

  let peak = settings.startingCash;
  let maxDrawdown = 0;
  equity.forEach(({ value }) => {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  });

  const closedTrades = trades.filter((trade) => trade.side === "Sell");
  const winners = closedTrades.filter((trade) => (trade.returnPercent ?? 0) > 0).length;
  const grossProfit = closedTrades.reduce((sum, trade) => sum + Math.max(trade.profitLoss ?? 0, 0), 0);
  const grossLoss = closedTrades.reduce((sum, trade) => sum + Math.abs(Math.min(trade.profitLoss ?? 0, 0)), 0);
  const equityValues = equity.map((point) => point.value);

  return {
    strategy: settings.strategy,
    equity,
    trades,
    netReturn: (cash / settings.startingCash - 1) * 100,
    netProfit: cash - settings.startingCash,
    maxDrawdown: maxDrawdown * 100,
    winRate: closedTrades.length ? (winners / closedTrades.length) * 100 : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    closedTradeCount: closedTrades.length,
    averageTradeReturn: closedTrades.length ? closedTrades.reduce((sum, trade) => sum + (trade.returnPercent ?? 0), 0) / closedTrades.length : null,
    peakEquity: Math.max(...equityValues),
    lowestEquity: Math.min(...equityValues),
    startingCash: settings.startingCash,
    timeInMarket: (barsInMarket / candles.length) * 100,
    endingCash: cash,
  };
}
