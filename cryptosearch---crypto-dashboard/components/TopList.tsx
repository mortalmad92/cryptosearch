import React from 'react';
import { TickerData } from '../types';

interface TopListProps {
  data: TickerData[];
  onSelect: (symbol: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

const TopList: React.FC<TopListProps> = ({ data, onSelect, isLoading, onRefresh }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <span>🏆</span> Топ-50 криптовалют
        </h2>
        <button 
          onClick={onRefresh}
          className="text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
             <span>🔄</span>
          )}
          Оновити
        </button>
      </div>
      
      <div className="overflow-x-auto">
        {isLoading && data.length === 0 ? (
           <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p>Завантаження монет...</p>
           </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">#</th>
                <th className="px-6 py-4 font-medium">Монета</th>
                <th className="px-6 py-4 font-medium">Ціна</th>
                <th className="px-6 py-4 font-medium text-right">Зміна (24г)</th>
                <th className="px-6 py-4 font-medium text-right hidden md:table-cell">Об'єм (24г)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.map((coin, index) => {
                const change = parseFloat(coin.priceChangePercent);
                const isPositive = change >= 0;
                // Remove USDT from display
                const displayName = coin.symbol.replace('USDT', '');
                const price = parseFloat(coin.lastPrice);
                
                return (
                  <tr 
                    key={coin.symbol} 
                    onClick={() => onSelect(displayName)}
                    className="hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-gray-400 font-medium w-12">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 dark:text-white">{displayName}</div>
                      <div className="text-xs text-gray-400">USDT</div>
                    </td>
                    <td className="px-6 py-4 text-gray-800 dark:text-gray-200 font-medium font-mono">
                      ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 8 : 2 })}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isPositive ? '+' : ''}{change.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      ${(parseFloat(coin.volume) * parseFloat(coin.lastPrice) / 1000000).toFixed(2)}M
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TopList;