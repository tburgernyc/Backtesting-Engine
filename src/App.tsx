import { useEffect, useState } from "react";
import { loadMarketData, parseCsv, type Provider } from "./data";
import { runBacktest, strategies, type BacktestResult, type Candle, type Settings, type StrategyId } from "./backtest";

type Source = Provider | "csv";
type CustomStrategy = { id: string; name: string; settings: Settings };
type RunRecord = { id: string; createdAt: string; source: string; strategy: string; netProfit: number; netReturn: number; endingCash: number; maxDrawdown: number; closedTrades: number; profitFactor: number | null };

const symbols: Record<Provider, { value: string; label: string }[]> = {
  binance: [
    { value: "BTCUSDT", label: "BTC / USDT" }, { value: "ETHUSDT", label: "ETH / USDT" }, { value: "SOLUSDT", label: "SOL / USDT" },
    { value: "BNBUSDT", label: "BNB / USDT" }, { value: "XRPUSDT", label: "XRP / USDT" }, { value: "DOGEUSDT", label: "DOGE / USDT" },
  ],
  alpaca: [
    { value: "AAPL", label: "Apple · AAPL" }, { value: "MSFT", label: "Microsoft · MSFT" }, { value: "NVDA", label: "NVIDIA · NVDA" },
    { value: "AMZN", label: "Amazon · AMZN" }, { value: "TSLA", label: "Tesla · TSLA" }, { value: "SPY", label: "S&P 500 ETF · SPY" }, { value: "QQQ", label: "Nasdaq 100 ETF · QQQ" },
  ],
};

const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
const dateInput = (value: Date) => value.toISOString().slice(0, 10);
const defaultSettings: Settings = { strategy: "sma-crossover", fastPeriod: 12, slowPeriod: 36, rsiPeriod: 14, rsiEntry: 30, rsiExit: 60, startingCash: 10_000, feePercent: 0.1 };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const factor = (value: number | null) => value === null ? "—" : `${value.toFixed(2)}×`;
const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function EquityChart({ values, startingCash }: { values: { date: string; value: number }[]; startingCash: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 760;
  const height = 230;
  const minimum = Math.min(...values.map((point) => point.value));
  const maximum = Math.max(...values.map((point) => point.value));
  const range = maximum - minimum || 1;
  const pointAt = (index: number) => ({ x: (index / (values.length - 1)) * width, y: height - ((values[index].value - minimum) / range) * height });
  const points = values.map((_, index) => { const point = pointAt(index); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(" ");
  const activeIndex = hoveredIndex ?? values.length - 1;
  const active = values[activeIndex];
  const activePoint = pointAt(activeIndex);
  const setPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setHoveredIndex(Math.max(0, Math.min(values.length - 1, Math.round(((event.clientX - box.left) / box.width) * (values.length - 1)))));
  };
  return <div className="chart"><div className="chart-summary" aria-live="polite"><span>Equity curve · hover to inspect</span><strong>{money.format(active.value)}</strong><small>{shortDate(active.date)} · {percent((active.value / startingCash - 1) * 100)}</small></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive equity value over time" preserveAspectRatio="none" onPointerMove={setPointer} onPointerLeave={() => setHoveredIndex(null)}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" /><line x1={activePoint.x} x2={activePoint.x} y1="0" y2={height} className="chart-crosshair" vectorEffect="non-scaling-stroke" /><circle cx={activePoint.x} cy={activePoint.y} r="5" className="chart-point" vectorEffect="non-scaling-stroke" /></svg><div className="chart-dates"><span>{shortDate(values[0].date)}</span><span>{shortDate(values[values.length - 1].date)}</span></div></div>;
}

function Result({ result, candles, label, strategyLabel }: { result: BacktestResult; candles: Candle[]; label: string; strategyLabel: string }) {
  const outcome = result.netProfit >= 0 ? "above" : "below";
  return <><div className="section-heading"><div><h2>{strategyLabel}</h2></div><span>{candles.length.toLocaleString()} real candles · {label}</span></div><div className="metrics"><article><span>Net P/L</span><strong className={result.netProfit >= 0 ? "positive" : "negative"}>{money.format(result.netProfit)}</strong><small>{percent(result.netReturn)} return</small></article><article><span>Ending equity</span><strong>{money.format(result.endingCash)}</strong><small>after all fees</small></article><article><span>Peak equity</span><strong>{money.format(result.peakEquity)}</strong><small>highest account value</small></article><article><span>Low equity</span><strong>{money.format(result.lowestEquity)}</strong><small>lowest account value</small></article><article><span>Max drawdown</span><strong className="negative">{percent(result.maxDrawdown)}</strong><small>from peak equity</small></article><article><span>Closed trades</span><strong>{result.closedTradeCount}</strong><small>completed positions</small></article><article><span>Win rate</span><strong>{percent(result.winRate)}</strong><small>{percent(result.averageTradeReturn)} average trade</small></article><article><span>Profit factor</span><strong>{factor(result.profitFactor)}</strong><small>gross profit / loss</small></article></div><EquityChart values={result.equity} startingCash={result.startingCash} /><section className="insights" aria-label="Run insights"><article><span>Outcome</span><strong>Finished {money.format(Math.abs(result.netProfit))} {outcome} starting cash.</strong></article><article><span>Risk</span><strong>The largest peak-to-trough decline was {percent(result.maxDrawdown)}.</strong></article><article><span>Exposure</span><strong>Capital was in the market for {percent(result.timeInMarket)} of the sample.</strong></article></section></>;
}

function History({ runs, onBacktest }: { runs: RunRecord[]; onBacktest: () => void }) {
  return <section className="history-page"><header className="history-header"><div><h1>History</h1><p>Latest runs are stored locally in this browser.</p></div><span>{runs.length} saved runs</span></header>{runs.length ? <div className="history-list">{runs.map((run) => <button type="button" className="history-row" key={run.id} onClick={onBacktest}><div><strong>{run.strategy}</strong><small>{run.source} · {new Date(run.createdAt).toLocaleString()}</small></div><span><small>Net P/L</small><strong className={run.netProfit >= 0 ? "positive" : "negative"}>{money.format(run.netProfit)}</strong><em>{percent(run.netReturn)}</em></span><span><small>Ending equity</small><strong>{money.format(run.endingCash)}</strong></span><span><small>Max drawdown</small><strong className="negative">{percent(run.maxDrawdown)}</strong></span><span><small>Trades</small><strong>{run.closedTrades}</strong><em>PF {factor(run.profitFactor)}</em></span></button>)}</div> : <div className="history-empty"><h2>No runs yet</h2><p>Run a backtest and it will appear here automatically.</p><button type="button" onClick={onBacktest}>Go to backtesting</button></div>}</section>
}

export default function App() {
  const [activeView, setActiveView] = useState<"backtest" | "history">("backtest");
  const [source, setSource] = useState<Source>("binance");
  const [symbolChoice, setSymbolChoice] = useState("BTCUSDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [interval, setInterval] = useState("1d");
  const [start, setStart] = useState(dateInput(oneYearAgo));
  const [end, setEnd] = useState(dateInput(new Date()));
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [strategyChoice, setStrategyChoice] = useState(`builtin:${defaultSettings.strategy}`);
  const [customName, setCustomName] = useState("");
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>(() => {
    try { return JSON.parse(localStorage.getItem("research-desk-strategies") || localStorage.getItem("backtest-starter-strategies") || "[]") as CustomStrategy[]; } catch { return []; }
  });
  const [runHistory, setRunHistory] = useState<RunRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("research-desk-history") || "[]") as RunRecord[]; } catch { return []; }
  });
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [resultStrategyLabel, setResultStrategyLabel] = useState("");
  const [dataLabel, setDataLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { localStorage.setItem("research-desk-strategies", JSON.stringify(customStrategies)); }, [customStrategies]);
  useEffect(() => { localStorage.setItem("research-desk-history", JSON.stringify(runHistory)); }, [runHistory]);

  const selectedSymbol = symbolChoice === "custom" ? customSymbol.trim().toUpperCase() : symbolChoice;
  const activeCustom = strategyChoice.startsWith("custom:") ? customStrategies.find((item) => item.id === strategyChoice.slice(7)) : undefined;
  const selectedStrategyLabel = activeCustom?.name || strategies[settings.strategy].label;

  function update(field: keyof Settings, value: string) { setSettings((current) => ({ ...current, [field]: Number(value) })); }

  function chooseSource(next: Source) {
    setSource(next);
    if (next === "binance") setSymbolChoice("BTCUSDT");
    if (next === "alpaca") setSymbolChoice("AAPL");
  }

  function chooseStrategy(next: string) {
    setStrategyChoice(next);
    if (next.startsWith("builtin:")) setSettings((current) => ({ ...current, strategy: next.slice(8) as StrategyId }));
    const saved = customStrategies.find((item) => `custom:${item.id}` === next);
    if (saved) setSettings(saved.settings);
  }

  function saveCustomStrategy() {
    const name = customName.trim();
    if (!name) { setError("Give your custom strategy a name before saving it."); return; }
    const custom = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, settings: { ...settings } };
    setCustomStrategies((current) => [...current, custom]);
    setStrategyChoice(`custom:${custom.id}`);
    setCustomName("");
    setError("");
  }

  function deleteCustomStrategy() {
    if (!activeCustom) return;
    setCustomStrategies((current) => current.filter((item) => item.id !== activeCustom.id));
    setStrategyChoice(`builtin:${settings.strategy}`);
  }

  async function loadAndRun(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const loaded = source === "csv"
        ? csvFile ? await parseCsv(csvFile) : (() => { throw new Error("Choose a CSV file first."); })()
        : await loadMarketData({ provider: source, symbol: selectedSymbol, interval, start, end });
      const nextResult = runBacktest(loaded, settings);
      const nextDataLabel = source === "csv" ? csvFile!.name : `${source === "binance" ? "Binance" : "Alpaca"} · ${selectedSymbol} · ${interval}`;
      setCandles(loaded);
      setResult(nextResult);
      setResultStrategyLabel(selectedStrategyLabel);
      setDataLabel(nextDataLabel);
      setRunHistory((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), source: nextDataLabel, strategy: selectedStrategyLabel, netProfit: nextResult.netProfit, netReturn: nextResult.netReturn, endingCash: nextResult.endingCash, maxDrawdown: nextResult.maxDrawdown, closedTrades: nextResult.closedTradeCount, profitFactor: nextResult.profitFactor }, ...current].slice(0, 50));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load and run this backtest."); } finally { setBusy(false); }
  }

  return <main className="app-shell">
    <aside className="side-nav"><div className="side-brand"><strong>Research Desk</strong><span>Local research</span></div><nav aria-label="Workspace"><button type="button" className={activeView === "backtest" ? "active" : ""} onClick={() => setActiveView("backtest")}>Backtesting</button><button type="button" className={activeView === "history" ? "active" : ""} onClick={() => setActiveView("history")}>History{runHistory.length > 0 && <em>{runHistory.length}</em>}</button></nav><small>Runs stay in this browser.</small></aside>
    <section className="app-content">{activeView === "backtest" ? <>
    <section className="workspace" aria-label="Backtest workspace">
      <form className="settings" onSubmit={loadAndRun}>
        <div className="section-heading"><div><h2>Data source</h2></div></div>
        <label>Data source<select value={source} onChange={(event) => chooseSource(event.target.value as Source)}><option value="binance">Binance public market data</option><option value="alpaca">Alpaca stocks (local credentials required)</option><option value="csv">CSV file</option></select></label>
        {source === "csv" ? <label>CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] || null)} /><small>Needs timestamp/date and close columns.</small></label> : <><label>Symbol<select value={symbolChoice} onChange={(event) => setSymbolChoice(event.target.value)}>{symbols[source].map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}<option value="custom">Custom symbol…</option></select></label>{symbolChoice === "custom" && <label>Custom symbol<input value={customSymbol} onChange={(event) => setCustomSymbol(event.target.value)} placeholder={source === "binance" ? "BTCUSDT" : "AAPL"} /></label>}<label>Timeframe<select value={interval} onChange={(event) => setInterval(event.target.value)}><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="1d">1 day</option></select></label><div className="field-row"><label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div></>}
        {source === "binance" && <p className="hint">Public historical candles need no Binance key.</p>}
        {source === "alpaca" && <p className="hint">This source needs your local Alpaca credentials. Binance and CSV imports do not.</p>}
        <div className="divider" />
        <div className="section-heading compact"><div><h2>Strategy</h2></div></div>
        <label>Strategy<select value={strategyChoice} onChange={(event) => chooseStrategy(event.target.value)}><optgroup label="Built in">{Object.entries(strategies).map(([id, strategy]) => <option value={`builtin:${id}`} key={id}>{strategy.label}</option>)}</optgroup>{customStrategies.length > 0 && <optgroup label="My saved strategies">{customStrategies.map((strategy) => <option value={`custom:${strategy.id}`} key={strategy.id}>{strategy.name}</option>)}</optgroup>}</select><small>{activeCustom ? `Saved custom strategy · ${strategies[settings.strategy].description}` : strategies[settings.strategy].description}</small></label>
        {settings.strategy === "sma-crossover" && <div className="field-row"><label>Fast SMA<input type="number" min="2" value={settings.fastPeriod} onChange={(event) => update("fastPeriod", event.target.value)} /></label><label>Slow SMA<input type="number" min="3" value={settings.slowPeriod} onChange={(event) => update("slowPeriod", event.target.value)} /></label></div>}
        {settings.strategy === "rsi-reversion" && <><div className="field-row"><label>RSI period<input type="number" min="2" value={settings.rsiPeriod} onChange={(event) => update("rsiPeriod", event.target.value)} /></label><label>Buy below RSI<input type="number" min="1" max="99" value={settings.rsiEntry} onChange={(event) => update("rsiEntry", event.target.value)} /></label></div><label>Sell above RSI<input type="number" min="1" max="99" value={settings.rsiExit} onChange={(event) => update("rsiExit", event.target.value)} /></label></>}
        <div className="field-row"><label>Starting cash<input type="number" min="100" step="100" value={settings.startingCash} onChange={(event) => update("startingCash", event.target.value)} /></label><label>Fee (%)<input type="number" min="0" step="0.01" value={settings.feePercent} onChange={(event) => update("feePercent", event.target.value)} /></label></div>
        <div className="custom-save"><label>Save as custom strategy<input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. My BTC trend rules" /></label><button type="button" onClick={saveCustomStrategy}>Save strategy</button></div>{activeCustom && <button className="delete-strategy" type="button" onClick={deleteCustomStrategy}>Delete “{activeCustom.name}”</button>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Loading real data…" : "Load data & run backtest"}</button>
      </form>
      <div className="results">{result && candles ? <Result result={result} candles={candles} label={dataLabel} strategyLabel={resultStrategyLabel} /> : <div className="run-guide"><header><div><h2>Results</h2><p>Current configuration</p></div><span>Not run</span></header><div className="guide-steps"><article><span>Market</span><strong>{source === "csv" ? "CSV file" : source === "binance" ? "Binance" : "Alpaca"}</strong><small>{source === "csv" ? csvFile?.name || "No file selected" : `${selectedSymbol || "Choose a symbol"} · ${interval}`}</small></article><article><span>Strategy</span><strong>{selectedStrategyLabel}</strong><small>{strategies[settings.strategy].description}</small></article><article><span>Execution</span><strong>{money.format(settings.startingCash)}</strong><small>{settings.feePercent}% fee · long only</small></article></div><p className="guide-note">Load data to calculate returns, drawdown, an equity curve, and the complete trade log.</p></div>}</div>
    </section>
    {result && candles && <section className="trades-section"><div className="section-heading"><div><h2>Trades</h2></div><span>{result.trades.filter((trade) => trade.side === "Sell").length} closed positions</span></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Price</th><th>Trade return</th></tr></thead><tbody>{result.trades.map((trade, index) => <tr key={`${trade.timestamp}-${index}`}><td>{shortDate(trade.timestamp)}</td><td><span className={`tag ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td>{money.format(trade.price)}</td><td className={(trade.returnPercent ?? 0) > 0 ? "positive" : (trade.returnPercent ?? 0) < 0 ? "negative" : ""}>{trade.returnPercent === undefined ? "—" : percent(trade.returnPercent)}</td></tr>)}</tbody></table>{!result.trades.length && <p className="empty">No signals for these rules and candles.</p>}</div></section>}
    <footer>Educational software, not investment advice. Historical results can be misleading and do not predict future returns.</footer>
    </> : <History runs={runHistory} onBacktest={() => setActiveView("backtest")} />}</section>
  </main>;
}
