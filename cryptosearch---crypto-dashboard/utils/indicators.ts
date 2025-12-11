import { KlineData } from '../types';

export const calculateEMA = (data: KlineData[], period: number): (number | null)[] => {
  const k = 2 / (period + 1);
  const emaArray: (number | null)[] = [];
  let ema = data[0].close;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      emaArray.push(null); 
      // Simple moving average for the first point or accumulation
      ema = ((ema * i) + data[i].close) / (i + 1); 
      continue;
    }
    
    // Initial SMA for the first valid point to stabilize
    if (i === period - 1) {
        let sum = 0;
        for(let j=0; j <= i; j++) sum += data[j].close;
        ema = sum / period;
        emaArray.push(ema);
        continue;
    }

    ema = data[i].close * k + ema * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
};

export const calculateRSI = (data: KlineData[], period: number = 14): (number | null)[] => {
  const rsiArray: (number | null)[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rsiArray.push(null);
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    if (i < period) {
      gains += gain;
      losses += loss;
      rsiArray.push(null);
    } else if (i === period) {
      let avgGain = gains / period;
      let avgLoss = losses / period;
      let rs = avgGain / avgLoss;
      rsiArray.push(100 - (100 / (1 + rs)));
    } else {
      rsiArray.push(null); // Placeholder for simplicity logic break
    }
  }

  // Correct Wilder's implementation
  const result: (number | null)[] = new Array(data.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    if (i < period) {
       avgGain += gain;
       avgLoss += loss;
    } else if (i === period) {
       avgGain /= period;
       avgLoss /= period;
       const rs = avgGain / avgLoss;
       result[i] = 100 - (100 / (1 + rs));
    } else {
       avgGain = (avgGain * (period - 1) + gain) / period;
       avgLoss = (avgLoss * (period - 1) + loss) / period;
       const rs = avgGain / avgLoss;
       result[i] = 100 - (100 / (1 + rs));
    }
  }
  return result;
};

export const calculateKDJ = (data: KlineData[], period: number = 9): { k: (number|null)[], d: (number|null)[], j: (number|null)[] } => {
  const K: (number | null)[] = [];
  const D: (number | null)[] = [];
  const J: (number | null)[] = [];

  let kValue = 50;
  let dValue = 50;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      K.push(null);
      D.push(null);
      J.push(null);
      continue;
    }

    // Find Highest High and Lowest Low in last 'period' days
    let low = data[i].low;
    let high = data[i].high;
    
    for (let j = 0; j < period; j++) {
        if (data[i - j].low < low) low = data[i - j].low;
        if (data[i - j].high > high) high = data[i - j].high;
    }

    const rsv = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;
    
    kValue = (2 / 3) * kValue + (1 / 3) * rsv;
    dValue = (2 / 3) * dValue + (1 / 3) * kValue;
    const jValue = 3 * kValue - 2 * dValue;

    K.push(kValue);
    D.push(dValue);
    J.push(jValue);
  }

  return { k: K, d: D, j: J };
};

export const calculateSAR = (data: KlineData[], startAf = 0.02, maxAf = 0.2): (number | null)[] => {
  if (data.length === 0) return [];

  const sar: (number | null)[] = new Array(data.length).fill(null);
  
  // Need at least some data to start
  if (data.length < 5) return sar;

  // Determine initial trend based on first candle
  let isUptrend = data[0].close > data[0].open;
  let ep = isUptrend ? data[0].high : data[0].low;
  let af = startAf;
  
  // Initial SAR is the opposite extreme point of the previous trend
  sar[0] = isUptrend ? data[0].low : data[0].high;

  for (let i = 1; i < data.length; i++) {
    const prevSar = sar[i - 1]!;
    
    // Calculate new SAR
    let newSar = prevSar + af * (ep - prevSar);

    // Rule: SAR cannot be above the low of the previous 2 periods in an uptrend
    // Rule: SAR cannot be below the high of the previous 2 periods in a downtrend
    if (isUptrend) {
       const low1 = data[i - 1].low;
       const low2 = i > 1 ? data[i - 2].low : low1;
       if (newSar > low1) newSar = low1;
       if (newSar > low2) newSar = low2;
    } else {
       const high1 = data[i - 1].high;
       const high2 = i > 1 ? data[i - 2].high : high1;
       if (newSar < high1) newSar = high1;
       if (newSar < high2) newSar = high2;
    }

    // Check for reversal
    let reversed = false;
    if (isUptrend) {
        if (data[i].low < newSar) {
            isUptrend = false;
            reversed = true;
            newSar = ep; // Reset SAR to EP
            ep = data[i].low; // New EP
            af = startAf;
        }
    } else {
        if (data[i].high > newSar) {
            isUptrend = true;
            reversed = true;
            newSar = ep;
            ep = data[i].high;
            af = startAf;
        }
    }

    if (!reversed) {
        // Update EP and AF
        if (isUptrend) {
            if (data[i].high > ep) {
                ep = data[i].high;
                af = Math.min(af + startAf, maxAf);
            }
        } else {
            if (data[i].low < ep) {
                ep = data[i].low;
                af = Math.min(af + startAf, maxAf);
            }
        }
    }

    sar[i] = newSar;
  }

  return sar;
};