import React from 'react';

interface HeaderProps {
  onLogoClick: () => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick, isDark, toggleTheme }) => {
  return (
    <header className="flex items-center justify-between px-6 py-6 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 transition-colors duration-300">
      <div 
        onClick={onLogoClick} 
        className="cursor-pointer select-none"
      >
        <div className="flex items-center text-3xl font-bold tracking-tight">
          <span className="text-[#3b82f6]">Crypto</span>
          <span className="text-[#10b981]">Search</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Реальні графіки криптовалют</p>
      </div>
      
      {/* Dark Mode Toggle */}
      <div className="flex items-center gap-3">
         <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {isDark ? 'Темна' : 'Світла'} тема
         </span>
         <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
            <input 
                type="checkbox" 
                name="toggle" 
                id="toggle" 
                checked={isDark}
                onChange={toggleTheme}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 dark:border-slate-600 checked:border-blue-500 transition-all duration-300"
                style={{ right: isDark ? '0' : 'auto', left: isDark ? 'auto' : '0' }}
            />
            <label 
                htmlFor="toggle" 
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${isDark ? 'bg-blue-600' : 'bg-gray-300'}`}
            ></label>
        </div>
      </div>
    </header>
  );
};

export default Header;