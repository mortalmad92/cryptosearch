import { KlineData, TickerData, ExchangeType } from '../types';

// API Endpoints
const BINANCE_API = 'https://api.binance.com/api/v3';
const BYBIT_API = 'https://api.bybit.com/v5/market';
const MEXC_API = 'https://api.mexc.com/api/v3';
const GATE_API = 'https://api.gateio.ws/api/v4';
const OKX_API = 'https://www.okx.com/api/v5/market';

// Proxy URL to bypass CORS if direct access fails
// Using 'get' endpoint of allorigins which returns JSON with a 'contents' string
const PROXY_URL = 'https://api.allorigins.win/get?url=';

// Helper: Fetch with Fallback (Try Direct -> Try Proxy)
const fetchWithFallback = async (url: string): Promise<any> => {
  try {
    // 1. Try Direct
    const res = await fetch(url);
    if (res.ok) return await res.json();
    throw new Error('Direct fetch failed');
  } catch (err) {
    // 2. Try Proxy
    // console.warn(`Direct fetch failed for ${url}, trying proxy...`);
    try {
      const proxyUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Proxy fetch failed: ${res.statusText}`);
      
      const proxyData = await res.json();
      
      // AllOrigins returns the actual response body in the 'contents' field
      if (proxyData.contents) {
         // Attempt to parse the contents string as JSON
         try {
             return JSON.parse(proxyData.contents);
         } catch (parseError) {
             // If not JSON, return raw (though for this app we expect JSON)
             return proxyData.contents;
         }
      }
      throw new Error('Proxy response missing contents');
    } catch (proxyErr) {
      console.error("Fetch failed:", proxyErr);
      throw proxyErr;
    }
  }
};

// Helper to standardise symbol PER EXCHANGE
export const getExchangeSymbol = (symbol: string, exchange: ExchangeType): string => {
  const s = symbol.toUpperCase();
  switch (exchange) {
    case 'Gate': return `${s}_USDT`;
    case 'OKX': return `${s}-USDT`;
    default: return `${s}USDT`;
  }
};

// --- ADAPTERS ---

const mapBinanceTicker = (data: any): TickerData => ({
  symbol: data.symbol,
  priceChange: data.priceChange,
  priceChangePercent: data.priceChangePercent,
  lastPrice: data.lastPrice,
  highPrice: data.highPrice,
  lowPrice: data.lowPrice,
  volume: data.quoteVolume,
  exchange: 'Binance'
});

const mapBybitTicker = (data: any): TickerData => {
  const t = data.result.list[0];
  return {
    symbol: t.symbol,
    priceChange: t.prevPrice24h ? (parseFloat(t.lastPrice) - parseFloat(t.prevPrice24h)).toString() : '0',
    priceChangePercent: (parseFloat(t.price24hPcnt) * 100).toFixed(2),
    lastPrice: t.lastPrice,
    highPrice: t.highPrice24h,
    lowPrice: t.lowPrice24h,
    volume: t.turnover24h,
    exchange: 'Bybit'
  };
};

const mapMexcTicker = (data: any): TickerData => ({
  symbol: data.symbol,
  priceChange: data.priceChange,
  priceChangePercent: data.priceChangePercent,
  lastPrice: data.lastPrice,
  highPrice: data.highPrice,
  lowPrice: data.lowPrice,
  volume: data.quoteVolume,
  exchange: 'MEXC'
});

const mapGateTicker = (data: any): TickerData => ({
  symbol: data.currency_pair.replace('_', ''),
  priceChange: (parseFloat(data.last) - parseFloat(data.last) / (1 + parseFloat(data.change_percentage) / 100)).toFixed(2),
  priceChangePercent: data.change_percentage,
  lastPrice: data.last,
  highPrice: data.high_24h,
  lowPrice: data.low_24h,
  volume: data.quote_volume,
  exchange: 'Gate'
});

const mapOkxTicker = (data: any): TickerData => {
  const t = data.data[0];
  const change = parseFloat(t.last) - parseFloat(t.open24h);
  const percent = (change / parseFloat(t.open24h)) * 100;
  return {
    symbol: t.instId.replace('-', ''),
    priceChange: change.toString(),
    priceChangePercent: percent.toFixed(2),
    lastPrice: t.last,
    highPrice: t.high24h,
    lowPrice: t.low24h,
    volume: t.volCcy24h,
    exchange: 'OKX'
  };
};


// --- INDIVIDUAL FETCHERS ---

const fetchBinanceTicker = async (symbol: string): Promise<TickerData> => {
    const formatted = getExchangeSymbol(symbol, 'Binance');
    const data = await fetchWithFallback(`${BINANCE_API}/ticker/24hr?symbol=${formatted}`);
    return mapBinanceTicker(data);
};

const fetchBybitTicker = async (symbol: string): Promise<TickerData> => {
    const formatted = getExchangeSymbol(symbol, 'Bybit');
    const data = await fetchWithFallback(`${BYBIT_API}/tickers?category=spot&symbol=${formatted}`);
    if (data.retCode !== 0 || !data.result.list || data.result.list.length === 0) throw new Error('Bybit not found');
    return mapBybitTicker(data);
};

const fetchMexcTicker = async (symbol: string): Promise<TickerData> => {
    const formatted = getExchangeSymbol(symbol, 'MEXC');
    const data = await fetchWithFallback(`${MEXC_API}/ticker/24hr?symbol=${formatted}`);
    if (!data.symbol) throw new Error('MEXC invalid data');
    return mapMexcTicker(data);
};

const fetchGateTicker = async (symbol: string): Promise<TickerData> => {
    const formatted = getExchangeSymbol(symbol, 'Gate');
    const data = await fetchWithFallback(`${GATE_API}/spot/tickers?currency_pair=${formatted}`);
    if (!data || data.length === 0) throw new Error('Gate not found');
    return mapGateTicker(data[0]);
};

const fetchOkxTicker = async (symbol: string): Promise<TickerData> => {
    const formatted = getExchangeSymbol(symbol, 'OKX');
    const data = await fetchWithFallback(`${OKX_API}/ticker?instId=${formatted}`);
    if (data.code !== '0' || !data.data || data.data.length === 0) throw new Error('OKX not found');
    return mapOkxTicker(data);
};

// --- PUBLIC ACTIONS ---

export const fetchTicker = async (symbol: string, exchange: ExchangeType): Promise<TickerData> => {
    switch(exchange) {
        case 'Binance': return fetchBinanceTicker(symbol);
        case 'Bybit': return fetchBybitTicker(symbol);
        case 'MEXC': return fetchMexcTicker(symbol);
        case 'Gate': return fetchGateTicker(symbol);
        case 'OKX': return fetchOkxTicker(symbol);
        default: throw new Error('Unknown Exchange');
    }
};

export const fetchAvailableTickers = async (symbol: string): Promise<TickerData[]> => {
    const results = await Promise.allSettled([
        fetchBinanceTicker(symbol),
        fetchBybitTicker(symbol),
        fetchMexcTicker(symbol),
        fetchGateTicker(symbol),
        fetchOkxTicker(symbol)
    ]);

    const tickers: TickerData[] = [];
    results.forEach(res => {
        if (res.status === 'fulfilled') {
            tickers.push(res.value);
        }
    });

    return tickers;
};

// 3. Unified Kline Fetch
export const fetchKlines = async (symbol: string, interval: string = '1h', limit: number = 500, exchange: ExchangeType = 'Binance'): Promise<KlineData[]> => {
  const formattedSymbol = getExchangeSymbol(symbol, exchange);

  try {
    if (exchange === 'Binance') {
        const data = await fetchWithFallback(`${BINANCE_API}/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
        if (!Array.isArray(data)) throw new Error('Invalid Binance Data');
        return data.map((d: any) => ({
        time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
    }

    if (exchange === 'Bybit') {
        let bybitInterval = interval;
        if (interval.endsWith('m')) bybitInterval = interval.replace('m', '');
        if (interval === '1h') bybitInterval = '60';
        if (interval === '4h') bybitInterval = '240';
        if (interval === '1d') bybitInterval = 'D';
        if (interval === '1w') bybitInterval = 'W';
        if (interval === '1M') bybitInterval = 'M';

        const data = await fetchWithFallback(`${BYBIT_API}/kline?category=spot&symbol=${formattedSymbol}&interval=${bybitInterval}&limit=${limit}`);
        const list = data.result?.list;
        if (!Array.isArray(list)) throw new Error('Invalid Bybit Data');
        return list.reverse().map((d: any) => ({
        time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
    }

    if (exchange === 'MEXC') {
        const data = await fetchWithFallback(`${MEXC_API}/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
        // MEXC returns data directly in an array for v3 klines
        if (!Array.isArray(data)) throw new Error('Invalid MEXC Data');
        return data.map((d: any) => ({
            time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
    }

    if (exchange === 'Gate') {
        const data = await fetchWithFallback(`${GATE_API}/spot/candlesticks?currency_pair=${formattedSymbol}&interval=${interval}&limit=${limit}`);
        if (!Array.isArray(data)) throw new Error('Invalid Gate Data');
        return data.map((d: any) => ({
            time: parseInt(d[0]) * 1000,
            open: parseFloat(d[5]), // Gate: t, v, c, h, l, o
            high: parseFloat(d[3]),
            low: parseFloat(d[4]),
            close: parseFloat(d[2]),
            volume: parseFloat(d[1]) 
        }));
    }

    if (exchange === 'OKX') {
        let okxInterval = interval;
        if (interval === '1h') okxInterval = '1H';
        if (interval === '4h') okxInterval = '4H';
        if (interval === '1d') okxInterval = '1D';
        
        const data = await fetchWithFallback(`${OKX_API}/candles?instId=${formattedSymbol}&bar=${okxInterval}&limit=${limit}`);
        if (!data.data || !Array.isArray(data.data)) throw new Error('Invalid OKX Data');
        return data.data.reverse().map((d: any) => ({
            time: parseInt(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[6])
        }));
    }
  } catch (error) {
      console.error(`Error fetching klines for ${exchange}:`, error);
      // Return empty array instead of throwing to prevent UI crashes, app will show loading or last state
      return [];
  }

  return [];
};

// 4. Fetch Top Coins (Binance)
export const fetchTopCoins = async (): Promise<TickerData[]> => {
  try {
    const data = await fetchWithFallback(`${BINANCE_API}/ticker/24hr`);
    if (!Array.isArray(data)) return [];
    
    const filtered = data.filter((t: any) => 
      t.symbol.endsWith('USDT') && 
      !['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'DAIUSDT'].includes(t.symbol)
    );
    filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
    return filtered.slice(0, 50).map(mapBinanceTicker);
  } catch (error) {
    console.error("Error fetching top coins:", error);
    return [];
  }
};