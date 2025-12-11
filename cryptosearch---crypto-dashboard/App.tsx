import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import CryptoChart from './components/CryptoChart';
import InfoCard from './components/InfoCard';
import TopList from './components/TopList';
import { fetchKlines, fetchAvailableTickers, fetchTicker, fetchTopCoins } from './services/binanceService';
import { subscribeToKline, unsubscribeKline } from './services/binanceStream';
import { getCoinAnalysis } from './services/geminiService';
import { KlineData, TickerData, FetchStatus, ExchangeType } from './types';
import { calculateSAR } from './utils/indicators';

const App: React.FC = () => {
  // Theme State - Default to Dark
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Data State
  const [query, setQuery] = useState<string>('');
  const [displayedSymbol, setDisplayedSymbol] = useState<string | null>(null);
  const [interval, setInterval] = useState<string>('15m');
  
  // Detail View State
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [availableExchanges, setAvailableExchanges] = useState<ExchangeType[]>([]);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const klineDataRef = useRef<KlineData[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Home View State (Top 10)
  const [topCoins, setTopCoins] = useState<TickerData[]>([]);
  const [isTopLoading, setIsTopLoading] = useState<boolean>(false);

  // Trend State
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    loadTopCoins();
    return () => {
        unsubscribeKline();
    };
  }, []);

  // Update trend whenever klineData changes
  useEffect(() => {
    if (klineData.length > 0) {
        const sar = calculateSAR(klineData);
        if (sar.length > 0) {
            const lastSar = sar[sar.length - 1];
            const lastClose = klineData[klineData.length - 1].close;
            if (lastSar !== null) {
                setTrend(lastClose > lastSar ? 'up' : 'down');
            }
        }
    }
  }, [klineData]);

  const loadTopCoins = async () => {
    setIsTopLoading(true);
    try {
        const coins = await fetchTopCoins();
        setTopCoins(coins);
    } catch (e) {
        console.error("Failed to load top coins", e);
    } finally {
        setIsTopLoading(false);
    }
  };

  /**
   * Main Data Loading Function
   * @param symbol - The symbol to search (e.g., BTC)
   * @param selectedInterval - Time interval
   * @param isNewSearch - If true, performs a full search logic. If false, assumes symbol exists and refreshes data/switches exchange.
   * @param forceExchange - Optional specific exchange to load.
   */
  const loadData = useCallback(async (
      symbol: string, 
      selectedInterval: string, 
      isNewSearch: boolean = true,
      forceExchange?: ExchangeType
  ) => {
    unsubscribeKline(); 
    
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (isNewSearch) {
        setStatus(FetchStatus.LOADING);
        setAnalysis(''); 
        setIsAnalyzing(true);
        setAvailableExchanges([]); // Reset availability
        setTrend(null);
    }
    
    const normalizedSymbol = symbol.toUpperCase();

    try {
      let currentTicker: TickerData | null = null;
      let targetExchange: ExchangeType = forceExchange || 'Binance';
      let isFastPathSuccess = false;

      // 1. FAST PATH: Try to fetch from the priority exchange immediately (default: Binance)
      // This avoids waiting for all exchanges to respond before showing the UI
      try {
          currentTicker = await fetchTicker(normalizedSymbol, targetExchange);
          isFastPathSuccess = true;
      } catch (err) {
          // If user specifically asked for this exchange and it failed, throw error
          if (forceExchange) throw err;
          // If it was default (Binance) and failed, we silently fail here and try the slow path (check all)
      }

      if (isFastPathSuccess && currentTicker) {
          // --- FAST PATH SUCCESS ---
          if (abortController.signal.aborted) return;

          setTickerData(currentTicker);
          setDisplayedSymbol(normalizedSymbol);
          
          if (isNewSearch) {
             setQuery(normalizedSymbol);
             // Show at least the current one while others load in background
             setAvailableExchanges([targetExchange]); 
             
             // Background: Check other exchanges availability
             fetchAvailableTickers(normalizedSymbol).then(tickers => {
                 if (!abortController.signal.aborted && tickers.length > 0) {
                     setAvailableExchanges(tickers.map(t => t.exchange));
                 }
             }).catch(e => console.warn("Background exchange check failed", e));
          }
      } else {
          // --- FALLBACK: SLOW PATH (Search All) ---
          // Used when default exchange doesn't have the symbol
          const availableTickers = await fetchAvailableTickers(normalizedSymbol);
          
          if (abortController.signal.aborted) return;
          if (availableTickers.length === 0) throw new Error('Not found');

          // Store available exchanges for the UI
          const exchanges = availableTickers.map(t => t.exchange);
          setAvailableExchanges(exchanges);

          // Select the first available exchange since default failed
          targetExchange = availableTickers[0].exchange;
          currentTicker = availableTickers[0];

          setTickerData(currentTicker);
          setDisplayedSymbol(normalizedSymbol);
          if (isNewSearch) {
            setQuery(normalizedSymbol); 
          }
      }

      // 2. Fetch Klines for target exchange
      const limit = 500; 
      const klines = await fetchKlines(normalizedSymbol, selectedInterval, limit, targetExchange);

      if (abortController.signal.aborted) return;

      setKlineData(klines);
      klineDataRef.current = klines;
      
      setStatus(FetchStatus.SUCCESS);

      // 3. Start Stream
      subscribeToKline(normalizedSymbol, selectedInterval, (newCandle) => {
         const currentData = klineDataRef.current;
         if (currentData.length === 0) return;

         const lastCandle = currentData[currentData.length - 1];
         let updatedData;
         
         if (lastCandle && newCandle.time === lastCandle.time) {
             updatedData = [...currentData.slice(0, -1), newCandle];
         } else {
             if (currentData.length > 500) {
                 updatedData = [...currentData.slice(1), newCandle];
             } else {
                 updatedData = [...currentData, newCandle];
             }
         }
         
         klineDataRef.current = updatedData;
         setKlineData(updatedData);
      }, targetExchange);

      // AI Analysis (Only on fresh search)
      if (isNewSearch && currentTicker) {
          getCoinAnalysis(normalizedSymbol, currentTicker).then((res) => {
             if (!abortController.signal.aborted) {
                setAnalysis(res);
                setIsAnalyzing(false);
             }
          });
      }

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error(error);
      setStatus(FetchStatus.ERROR);
      setDisplayedSymbol(null); 
      setIsAnalyzing(false);
    }
  }, [tickerData?.exchange]);

  const handleSearch = (term: string) => {
    setQuery(term);
    setInterval('15m');
    loadData(term, '15m', true);
  };

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval);
    if (displayedSymbol) {
        loadData(displayedSymbol, newInterval, false);
    }
  };

  const handleExchangeSwitch = (newExchange: ExchangeType) => {
      if (displayedSymbol) {
          loadData(displayedSymbol, interval, false, newExchange);
      }
  };

  const handleLogoClick = () => {
    unsubscribeKline();
    setDisplayedSymbol(null);
    setQuery('');
    setStatus(FetchStatus.IDLE);
    setTickerData(null);
  };

  const formatStatPrice = (valStr: string) => {
    const val = parseFloat(valStr);
    if (val < 1) return val.toFixed(8).replace(/\.?0+$/, '');
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header onLogoClick={handleLogoClick} isDark={theme === 'dark'} toggleTheme={toggleTheme} />

      <main className="flex-grow w-full max-w-[1800px] mx-auto px-4 md:px-6 py-8">
        
        <SearchBar onSearch={handleSearch} initialValue={query} />

        {status === FetchStatus.ERROR && (
           <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Не вдалося знайти "{query}" на Binance, Bybit або MEXC. Перевірте назву.
                  </p>
                </div>
              </div>
           </div>
        )}

        {status === FetchStatus.LOADING && (
          <div className="flex flex-col items-center justify-center py-20">
             <div className="google-loader mb-6">
              <span></span><span></span><span></span><span></span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">Пошук на біржах...</p>
          </div>
        )}

        {(status === FetchStatus.SUCCESS || (status === FetchStatus.LOADING && displayedSymbol && klineData.length > 0)) && displayedSymbol && tickerData && (
          <div className="animate-fade-in-up">
            <button 
                onClick={handleLogoClick} 
                className="mb-4 text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
                ← На головну
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <InfoCard 
                        ticker={tickerData} 
                        analysis={analysis} 
                        isAnalyzing={isAnalyzing}
                        symbol={displayedSymbol}
                        availableExchanges={availableExchanges}
                        onExchangeChange={handleExchangeSwitch}
                    />
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
                        <CryptoChart 
                          data={klineData} 
                          interval={interval}
                          onIntervalChange={handleIntervalChange}
                          isDark={theme === 'dark'}
                        />
                    </div>
                </div>
                <div className="lg:col-span-1">
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm sticky top-6 transition-colors duration-300">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-lg">Статистика 24г</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-700 pb-2">
                                <span className="text-gray-500 dark:text-gray-400">Найвища ціна</span>
                                <span className="font-medium dark:text-gray-200">${formatStatPrice(tickerData.highPrice)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-700 pb-2">
                                <span className="text-gray-500 dark:text-gray-400">Найнижча ціна</span>
                                <span className="font-medium dark:text-gray-200">${formatStatPrice(tickerData.lowPrice)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-700 pb-2">
                                <span className="text-gray-500 dark:text-gray-400">Об'єм (USDT)</span>
                                <span className="font-medium dark:text-gray-200">${parseInt(tickerData.volume).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-700 pb-2">
                                <span className="text-gray-500 dark:text-gray-400">Зміна</span>
                                <span className={`font-medium ${parseFloat(tickerData.priceChangePercent) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {tickerData.priceChangePercent}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-2">
                                <span className="text-gray-500 dark:text-gray-400">Тренд (SAR)</span>
                                <span className={`font-bold uppercase ${trend === 'up' ? 'text-green-600 dark:text-green-400' : (trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}`}>
                                    {trend === 'up' ? 'Висхідний' : (trend === 'down' ? 'Низхідний' : '-')}
                                </span>
                            </div>
                             <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-700">
                                <span className="text-gray-500 dark:text-gray-400">Біржа</span>
                                <span className="font-bold text-blue-500">{tickerData.exchange}</span>
                            </div>
                        </div>
                     </div>
                </div>
            </div>
          </div>
        )}

        {status === FetchStatus.IDLE && (
            <div className="animate-fade-in">
                <TopList 
                    data={topCoins} 
                    isLoading={isTopLoading} 
                    onSelect={(sym) => handleSearch(sym)}
                    onRefresh={loadTopCoins}
                />
            </div>
        )}
      </main>

      <footer className="py-6 border-t border-gray-200 dark:border-slate-700 mt-auto bg-white dark:bg-slate-800 transition-colors duration-300">
         <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-400 dark:text-gray-500">
            © 2025 CryptoSearch • Дані з {displayedSymbol && tickerData ? tickerData.exchange : 'Binance, Bybit, MEXC, Gate.io, OKX'}
         </div>
      </footer>
    </div>
  );
};

export default App;