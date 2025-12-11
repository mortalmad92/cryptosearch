import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { KlineData } from '../types';
import { calculateEMA, calculateRSI, calculateKDJ, calculateSAR } from '../utils/indicators';

interface CryptoChartProps {
  data: KlineData[];
  interval: string;
  onIntervalChange: (interval: string) => void;
  isDark: boolean;
}

interface ActiveData {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  amplitude: number;
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;
  sar: number | null;
  rsi: number | null;
  k: number | null;
  d: number | null;
  j: number | null;
}

const CryptoChart: React.FC<CryptoChartProps> = ({ data, interval, onIntervalChange, isDark }) => {
  const [activeData, setActiveData] = useState<ActiveData | null>(null);
  const [showSAR, setShowSAR] = useState<boolean>(false); // State for SAR visibility (Default: False)
  
  // Refs for direct DOM/Chart manipulation
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Modern TradingView-like Colors
  const COLORS = {
    bg: isDark ? '#161A25' : '#FFFFFF',
    grid: isDark ? '#2B2B43' : '#F0F3FA',
    text: isDark ? '#848E9C' : '#5E6673',
    up: '#26a69a',   // TradingView Mint Green
    down: '#ef5350', // TradingView Red
    ma7: '#F0B90B',  // Yellow
    ma25: '#FF9800', // Orange
    ma99: '#9C27B0', // Purple
    sar: isDark ? '#42A5F5' : '#2962FF', // Bright Blue
    crosshair: isDark ? '#FFFFFF' : '#131722',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
  };

  // Custom Wheel Zoom Logic
  useEffect(() => {
    const container = containerRef.current;
    
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
        const chart = chartRef.current?.chart;
        if (!chart || !chart.w.globals.minX || !chart.w.globals.maxX) return;

        e.preventDefault();
        e.stopPropagation();

        const { minX, maxX } = chart.w.globals;
        const range = maxX - minX;
        
        const zoomFactor = 0.10;
        const isZoomIn = e.deltaY < 0;

        let newMin = isZoomIn ? minX + range * zoomFactor / 2 : minX - range * zoomFactor / 2;
        let newMax = isZoomIn ? maxX - range * zoomFactor / 2 : maxX + range * zoomFactor / 2;

        if (newMax - newMin < 60000 && isZoomIn) return;

        chart.zoomX(newMin, newMax);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
        container.removeEventListener('wheel', handleWheel);
    };
  }, [data]);

  // Calculate Indicators
  const { candlestickData, ema7, ema25, ema99, sarData, volumeData, rsiData, kdjData, rawIndicators } = useMemo(() => {
    if (!data || data.length === 0) {
        return { 
            candlestickData: [], ema7: [], ema25: [], ema99: [], sarData: [], volumeData: [], rsiData: [], kdjData: {k:[], d:[], j:[]}, 
            rawIndicators: { ema7: [], ema25: [], ema99: [], sar: [], rsi: [], kdj: {k:[], d:[], j:[]} } 
        };
    }

    const candles = data.map(d => ({
      x: new Date(d.time),
      y: [d.open, d.high, d.low, d.close]
    }));

    const ema7Vals = calculateEMA(data, 7);
    const ema25Vals = calculateEMA(data, 25);
    const ema99Vals = calculateEMA(data, 99);
    const sarVals = calculateSAR(data);

    const ema7Arr = ema7Vals.map((v, i) => ({ x: new Date(data[i].time), y: v }));
    const ema25Arr = ema25Vals.map((v, i) => ({ x: new Date(data[i].time), y: v }));
    const ema99Arr = ema99Vals.map((v, i) => ({ x: new Date(data[i].time), y: v }));
    
    // Custom Color Logic for SAR:
    // Uptrend (Price > SAR) -> Green (COLORS.up)
    // Downtrend (Price < SAR) -> Red (COLORS.down)
    const sarArr = sarVals.map((v, i) => {
        if (v === null) return { x: new Date(data[i].time), y: null };
        const close = data[i].close;
        const isUptrend = close > v;
        // User requested: Uptrend = Green, Downtrend = Red
        const color = isUptrend ? COLORS.up : COLORS.down;
        return { 
            x: new Date(data[i].time), 
            y: v,
            fillColor: color,
            strokeColor: color
        };
    });
    
    const vol = data.map(d => ({
      x: new Date(d.time),
      y: d.volume,
      fillColor: d.close >= d.open ? COLORS.up : COLORS.down
    }));

    const rsiCalc = calculateRSI(data);
    const rsi = rsiCalc.map((v, i) => ({ x: new Date(data[i].time), y: v }));
    
    const kdjCalc = calculateKDJ(data);
    const kdj = {
        k: kdjCalc.k.map((v, i) => ({ x: new Date(data[i].time), y: v })),
        d: kdjCalc.d.map((v, i) => ({ x: new Date(data[i].time), y: v })),
        j: kdjCalc.j.map((v, i) => ({ x: new Date(data[i].time), y: v }))
    };

    return { 
        candlestickData: candles, 
        ema7: ema7Arr, 
        ema25: ema25Arr, 
        ema99: ema99Arr, 
        sarData: sarArr,
        volumeData: vol, 
        rsiData: rsi,
        kdjData: kdj,
        rawIndicators: { 
            ema7: ema7Vals, 
            ema25: ema25Vals, 
            ema99: ema99Vals,
            sar: sarVals,
            rsi: rsiCalc,
            kdj: kdjCalc
        }
    };
  }, [data, COLORS.up, COLORS.down]);

  useEffect(() => {
    if (data && data.length > 0) {
      const lastIdx = data.length - 1;
      updateActiveData(lastIdx);
    }
  }, [data]);

  const updateActiveData = (index: number) => {
    if (!data || index < 0 || index >= data.length) return;
    
    const d = data[index];
    const prevClose = index > 0 ? data[index - 1].close : d.open;
    const change = d.close - prevClose;
    const changePercent = (change / prevClose) * 100;
    const amplitude = ((d.high - d.low) / prevClose) * 100;

    setActiveData({
      time: new Date(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      change: changePercent,
      amplitude: amplitude,
      ma7: rawIndicators?.ema7[index] || null,
      ma25: rawIndicators?.ema25[index] || null,
      ma99: rawIndicators?.ema99[index] || null,
      sar: rawIndicators?.sar[index] || null,
      rsi: rawIndicators?.rsi[index] || null,
      k: rawIndicators?.kdj.k[index] || null,
      d: rawIndicators?.kdj.d[index] || null,
      j: rawIndicators?.kdj.j[index] || null,
    });
  };

  // Base Chart Options
  const commonOptions: ApexOptions = {
    chart: {
      group: 'binance-charts',
      animations: { enabled: false },
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    xaxis: {
      type: 'datetime',
      labels: { show: false }, 
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: true, offsetY: -10 },
      crosshairs: {
        show: true,
        width: 1,
        stroke: { color: COLORS.crosshair, dashArray: 4, width: 1 },
      }
    },
    grid: {
      borderColor: COLORS.grid,
      strokeDashArray: 2,
      xaxis: { lines: { show: true } },   
      yaxis: { lines: { show: true } },
      padding: { top: 0, bottom: 0, left: 16, right: 0 }
    },
    dataLabels: { enabled: false },
    yaxis: {
      opposite: true, 
      tickAmount: 8, // More ticks for better granularity
      labels: {
        align: 'left',
        minWidth: 40,
        style: { colors: COLORS.text, fontSize: '11px', fontFamily: 'Roboto Mono, monospace' },
        formatter: (val) => {
            if (val > 1000) return val.toFixed(2);
            if (val > 1) return val.toFixed(4);
            return val.toFixed(8).replace(/\.?0+$/, '');
        }
      },
      tooltip: { enabled: true }
    },
    tooltip: {
      enabled: true,
      shared: true,
      followCursor: true,
      intersect: false,
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'Roboto, sans-serif' },
      x: { format: 'dd MMM HH:mm' },
      marker: { show: false },
      fixed: { enabled: false, position: 'topRight' }
    }
  };

  // 1. MAIN CHART (Candles + EMA + SAR)
  const mainOptions: ApexOptions = {
    ...commonOptions,
    chart: { 
        ...commonOptions.chart, 
        id: 'main-chart', 
        height: 600, // Increased from 520
        events: {
            mouseMove: (event, chartContext, config) => {
               if (config.dataPointIndex !== -1) {
                  updateActiveData(config.dataPointIndex);
               }
            },
            mouseLeave: () => {
               if (data && data.length > 0) updateActiveData(data.length - 1);
            },
        }
    },
    stroke: { 
        width: [1, 2, 2, 2, 0], // Thicker EMA lines
        curve: 'smooth', // Smoother EMA
        dashArray: [0, 0, 0, 0, 0]
    },
    markers: {
        size: [0, 0, 0, 0, 2], // Reduced size from 3 to 2
        strokeWidth: 0,
        hover: { size: 5 }
    },
    plotOptions: {
      candlestick: {
        colors: { upward: COLORS.up, downward: COLORS.down },
        wick: { useFillColor: true }
      }
    },
    yaxis: {
        ...commonOptions.yaxis,
        // Add breathing room to min/max so candles don't touch edges
        labels: {
             ...(commonOptions.yaxis as any)?.labels,
             offsetY: -5
        }
    },
    legend: { show: false }
  };

  const mainSeries = [
      { name: 'Price', type: 'candlestick', data: candlestickData },
      { name: 'EMA 7', type: 'line', data: ema7, color: COLORS.ma7 },
      { name: 'EMA 25', type: 'line', data: ema25, color: COLORS.ma25 },
      { name: 'EMA 99', type: 'line', data: ema99, color: COLORS.ma99 },
      ...(showSAR ? [{ name: 'SAR', type: 'scatter', data: sarData }] : []) // Color determined by data points
  ];

  // 2. VOLUME CHART
  const volumeOptions: ApexOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, id: 'volume-chart', height: 120 }, // Increased
    plotOptions: { bar: { columnWidth: '70%', borderRadius: 1 } },
    yaxis: {
        opposite: true,
        labels: {
            formatter: (val) => {
                 if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
                 if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
                 return val.toFixed(0);
            },
            style: { colors: COLORS.text, fontSize: '10px', fontFamily: 'Roboto Mono' }
        }
    },
    grid: { ...commonOptions.grid, padding: { top: 0, bottom: 0, left: 16, right: 0 } },
    tooltip: { ...commonOptions.tooltip, shared: false }
  };

  // 3. RSI CHART
  const rsiOptions: ApexOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, id: 'rsi-chart', height: 120 }, // Increased
    yaxis: {
        opposite: true,
        min: 0, max: 100,
        tickAmount: 2,
        labels: { style: { colors: COLORS.text, fontSize: '10px', fontFamily: 'Roboto Mono' } }
    },
    annotations: {
        yaxis: [
            { y: 30, borderColor: COLORS.text, strokeDashArray: 2, opacity: 0.3, borderWidth: 1 },
            { y: 70, borderColor: COLORS.text, strokeDashArray: 2, opacity: 0.3, borderWidth: 1 }
        ]
    },
    stroke: { width: 1.5, colors: [COLORS.ma99] },
    grid: { ...commonOptions.grid, padding: { top: 10, bottom: 0, left: 16, right: 0 } },
  };

  // 4. KDJ CHART
  const kdjOptions: ApexOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, id: 'kdj-chart', height: 140 }, // Increased
    xaxis: {
        ...commonOptions.xaxis,
        labels: { 
            show: true, 
            style: { colors: COLORS.text, fontSize: '11px', fontFamily: 'Roboto Mono' },
            datetimeFormatter: { year: 'yyyy', month: "MMM", day: 'dd', hour: 'HH:mm' }
        },
        axisTicks: { show: true, color: COLORS.grid },
        axisBorder: { show: true, color: COLORS.grid }
    },
    yaxis: {
        opposite: true,
        tickAmount: 2,
        labels: { style: { colors: COLORS.text, fontSize: '10px', fontFamily: 'Roboto Mono' } }
    },
    stroke: { width: 1.5 },
    colors: ['#3b82f6', '#F0B90B', '#E91E63'],
    grid: { ...commonOptions.grid, padding: { top: 10, bottom: 0, left: 16, right: 0 } },
  };

  const timeframes = [
    { label: 'Час', value: '1s' }, 
    { label: '1сек', value: '1s' },
    { label: '1хв', value: '1m' },
    { label: '5хв', value: '5m' },
    { label: '15хв', value: '15m' },
    { label: '30хв', value: '30m' },
    { label: '1год', value: '1h' },
    { label: '4год', value: '4h' },
    { label: '12год', value: '12h' },
    { label: '1ден', value: '1d' },
    { label: '1тиж', value: '1w' },
    { label: '1міс', value: '1M' },
  ];

  const formatPrice = (p: number) => {
      if (p < 1) return p.toFixed(8).replace(/\.?0+$/, '');
      return p.toFixed(2);
  };
  
  const formatVol = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

  if (!data || data.length === 0) {
      return (
        <div className={`w-full h-[900px] flex items-center justify-center ${isDark ? 'bg-[#161A25] text-gray-500' : 'bg-white text-gray-400'}`}>
           Завантаження графіку...
        </div>
      );
  }

  const chartKey = `chart-${data[0].time}-${data.length}-${interval}`;

  return (
    <div key={chartKey} className={`w-full select-none ${isDark ? 'bg-[#161A25]' : 'bg-white'} rounded-none md:rounded-lg overflow-hidden flex flex-col shadow-lg border border-transparent dark:border-[#2B2B43]`}>
      {/* Timeframe Bar */}
      <div className={`flex items-center gap-1 px-4 py-3 text-sm font-medium border-b ${isDark ? 'border-[#2B2B43]' : 'border-gray-100'} overflow-x-auto no-scrollbar`}>
        {timeframes.map((tf, idx) => (
            tf.label === 'Час' ? <span key="l" className="mr-2 text-gray-400 hidden md:inline text-xs font-bold uppercase">Таймфрейм</span> :
            <button
                key={tf.value + idx}
                onClick={() => onIntervalChange(tf.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-gray-100 dark:hover:bg-[#2B2B43] transition-all whitespace-nowrap ${
                interval === tf.value
                    ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 dark:text-[#848E9C]'
                }`}
            >
                {tf.label}
            </button>
        ))}

        <div className="flex items-center gap-2 ml-auto pl-4 border-l border-gray-200 dark:border-slate-700">
             <span className={`text-[10px] font-bold ${showSAR ? 'text-blue-500' : 'text-gray-400'}`}>SAR</span>
             <button
                 onClick={() => setShowSAR(!showSAR)}
                 className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${showSAR ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
             >
                 <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform duration-200 shadow-sm ${showSAR ? 'translate-x-4' : 'translate-x-0.5'}`} />
             </button>
        </div>
      </div>

      {/* OHLC Legend Bar */}
      <div className="flex flex-wrap items-center gap-x-4 px-4 py-2 text-[11px] font-mono leading-tight min-h-[32px] border-b border-dashed border-gray-100 dark:border-gray-800">
        {activeData && (
          <>
             {/* MA Values */}
             <div className="flex gap-3 mr-4">
                 <span style={{color: COLORS.ma7}}>EMA(7): {activeData.ma7?.toFixed(2)}</span>
                 <span style={{color: COLORS.ma25}}>EMA(25): {activeData.ma25?.toFixed(2)}</span>
                 <span style={{color: COLORS.ma99}}>EMA(99): {activeData.ma99?.toFixed(2)}</span>
                 {showSAR && <span style={{color: COLORS.sar}}>SAR: {activeData.sar?.toFixed(2)}</span>}
             </div>
             {/* OHLC Values */}
             <div className="flex gap-3 hidden sm:flex">
                 <span className="text-gray-500">O: <span className={activeData.open > activeData.close ? 'text-[#ef5350]' : 'text-[#26a69a]'}>{formatPrice(activeData.open)}</span></span>
                 <span className="text-gray-500">H: <span className={activeData.high > activeData.open ? 'text-[#26a69a]' : 'text-gray-400'}>{formatPrice(activeData.high)}</span></span>
                 <span className="text-gray-500">L: <span className={activeData.low < activeData.open ? 'text-[#ef5350]' : 'text-gray-400'}>{formatPrice(activeData.low)}</span></span>
                 <span className="text-gray-500">C: <span className={activeData.close > activeData.open ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{formatPrice(activeData.close)}</span></span>
                 <span className="text-gray-500">Change: <span className={activeData.change >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{activeData.change.toFixed(2)}%</span></span>
             </div>
          </>
        )}
      </div>

      {/* Charts Area */}
      <div className="flex flex-col flex-1 relative" ref={containerRef}>
          <div className="flex-1 min-h-[600px]">
              <ReactApexChart 
                  key={interval + 'main' + showSAR} 
                  ref={chartRef}
                  options={mainOptions} 
                  series={mainSeries} 
                  type="candlestick" 
                  height="100%" 
              />
          </div>
          
          <div className="h-[120px] w-full border-t border-dashed" style={{ borderColor: COLORS.grid }}>
              <div className="absolute pl-4 pt-1 text-[10px] text-gray-400 z-10 font-mono">
                  Vol(USDT): <span className={activeData?.change && activeData.change >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{activeData ? formatVol(activeData.volume) : ''}</span>
              </div>
              <ReactApexChart key={interval + 'vol'} options={volumeOptions} series={[{ name: 'Volume', data: volumeData }]} type="bar" height="100%" />
          </div>

          <div className="h-[120px] w-full border-t border-dashed" style={{ borderColor: COLORS.grid }}>
               <div className="absolute pl-4 pt-1 text-[10px] text-gray-400 z-10 font-mono">
                   RSI(14): <span style={{color: COLORS.ma99}}>{activeData?.rsi?.toFixed(2)}</span>
               </div>
              <ReactApexChart key={interval + 'rsi'} options={rsiOptions} series={[{ name: 'RSI', data: rsiData }]} type="line" height="100%" />
          </div>

          <div className="h-[140px] w-full border-t border-dashed" style={{ borderColor: COLORS.grid }}>
               <div className="absolute pl-4 pt-1 text-[10px] text-gray-400 z-10 font-mono flex gap-2">
                   <span>KDJ(9,3,3)</span>
                   <span className="text-blue-500">K: {activeData?.k?.toFixed(2)}</span>
                   <span className="text-[#F0B90B]">D: {activeData?.d?.toFixed(2)}</span>
                   <span className="text-[#E91E63]">J: {activeData?.j?.toFixed(2)}</span>
               </div>
              <ReactApexChart 
                key={interval + 'kdj'}
                options={kdjOptions} 
                series={[
                    { name: 'K', data: kdjData.k },
                    { name: 'D', data: kdjData.d },
                    { name: 'J', data: kdjData.j }
                ]} 
                type="line" 
                height="100%" 
              />
          </div>
      </div>
    </div>
  );
};

export default CryptoChart;