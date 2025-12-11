export type ExchangeType = 'Binance' | 'Bybit' | 'MEXC' | 'Gate' | 'OKX';

export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  exchange: ExchangeType;
}

export interface CoinInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export enum FetchStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}