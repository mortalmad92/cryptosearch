import React from 'react';
import { TickerData, ExchangeType } from '../types';

interface InfoCardProps {
  ticker: TickerData;
  analysis: string;
  isAnalyzing: boolean;
  symbol: string;
  availableExchanges: ExchangeType[];
  onExchangeChange: (exchange: ExchangeType) => void;
}

const InfoCard: React.FC<InfoCardProps> = ({ 
    ticker, 
    analysis, 
    isAnalyzing, 
    symbol, 
    availableExchanges,
    onExchangeChange 
}) => {
  const priceChange = parseFloat(ticker.priceChangePercent);
  const isPositive = priceChange >= 0;
  const colorClass = isPositive ? 'text-green-600 dark:text-[#26a69a]' : 'text-red-600 dark:text-[#ef5350]';
  const arrow = isPositive ? '▲' : '▼';
  
  const lastPrice = parseFloat(ticker.lastPrice);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 8 : 2 
    });
  };

  const formatStat = (valStr: string) => {
    const val = parseFloat(valStr);
    if (val < 1) return val.toFixed(8).replace(/\.?0+$/, '');
    return val.toFixed(2);
  };

  const getExchangeColor = (ex: ExchangeType) => {
      switch(ex) {
          case 'Binance': return 'bg-[#F3BA2F] text-black';
          case 'Bybit': return 'bg-black text-white dark:bg-white dark:text-black';
          case 'MEXC': return 'bg-[#1C75BC] text-white';
          case 'Gate': return 'bg-[#FF515A] text-white';
          case 'OKX': return 'bg-black text-white border border-white dark:border-gray-600';
          default: return 'bg-gray-200 text-gray-800';
      }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors duration-300 shadow-sm">
      <div className="p-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{symbol.toUpperCase()} / USDT</h1>
                
                {/* Exchange Switcher */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                    {availableExchanges.length > 0 ? availableExchanges.map((ex) => (
                        <button
                            key={ex}
                            onClick={() => onExchangeChange(ex)}
                            className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                                ticker.exchange === ex 
                                    ? getExchangeColor(ex) + ' shadow-sm scale-105'
                                    : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 dark:text-gray-400'
                            }`}
                        >
                            {ex}
                        </button>
                    )) : (
                        <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider bg-gray-200 text-gray-800">
                            {ticker.exchange}
                        </span>
                    )}
                </div>
            </div>
            
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
                {formatPrice(lastPrice)}
              </span>
              <span className={`text-xl font-medium ${colorClass} flex items-center px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-slate-700/50`}>
                <span className="mr-1 text-sm">{arrow}</span>
                {Math.abs(priceChange).toFixed(2)}%
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Дані ринку в реальному часі</p>
          </div>
          
          <div className="hidden md:block text-right text-sm text-gray-500 dark:text-gray-400 font-mono">
            <div className="flex justify-end gap-2 mb-1"><span>High:</span> <span className="text-gray-800 dark:text-gray-200">${formatStat(ticker.highPrice)}</span></div>
            <div className="flex justify-end gap-2"><span>Low:</span> <span className="text-gray-800 dark:text-gray-200">${formatStat(ticker.lowPrice)}</span></div>
          </div>
        </div>

        {/* Stats Grid for Mobile */}
        <div className="md:hidden grid grid-cols-2 gap-4 mb-4 text-sm">
           <div className="border border-gray-100 dark:border-slate-600 p-2 rounded bg-gray-50 dark:bg-slate-700/30">
             <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase">High</span>
             <span className="dark:text-white font-mono">${formatStat(ticker.highPrice)}</span>
           </div>
           <div className="border border-gray-100 dark:border-slate-600 p-2 rounded bg-gray-50 dark:bg-slate-700/30">
             <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase">Low</span>
             <span className="dark:text-white font-mono">${formatStat(ticker.lowPrice)}</span>
           </div>
        </div>
      </div>
      
      {/* Gemini AI Analysis Section */}
      <div className="bg-blue-50 dark:bg-slate-900/50 p-6 border-t border-blue-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
           {/* Google Sparkle Icon */}
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.3 9.4L22 12L14.3 14.6L12 22L9.7 14.6L2 12L9.7 9.4L12 2Z" fill="url(#sparkleGradient)"/>
            <defs>
              <linearGradient id="sparkleGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4285F4"/>
                <stop offset="1" stopColor="#DB4437"/>
              </linearGradient>
            </defs>
          </svg>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">AI Аналіз ринку</h3>
        </div>
        
        {isAnalyzing ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2 bg-blue-200 dark:bg-slate-600 rounded w-3/4"></div>
              <div className="h-2 bg-blue-200 dark:bg-slate-600 rounded"></div>
              <div className="h-2 bg-blue-200 dark:bg-slate-600 rounded w-5/6"></div>
            </div>
          </div>
        ) : (
          <p className="text-gray-800 dark:text-gray-300 text-sm leading-relaxed font-normal">
            {analysis}
          </p>
        )}
      </div>
    </div>
  );
};

export default InfoCard;