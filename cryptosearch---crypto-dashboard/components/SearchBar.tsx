import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  initialValue?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, initialValue = '' }) => {
  const [term, setTerm] = useState(initialValue);
  
  useEffect(() => {
    setTerm(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      onSearch(term.trim());
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-6 transition-colors duration-300">
        <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="relative flex-grow">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                     <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                 </div>
                 <input
                    type="text"
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    placeholder="Введіть символ (BTC, ETH, XRP...)"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
            </div>
            <button 
                type="submit"
                className="bg-[#3b82f6] hover:bg-blue-600 text-white font-medium py-3 px-8 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
                Пошук
            </button>
        </form>
    </div>
  );
};

export default SearchBar;