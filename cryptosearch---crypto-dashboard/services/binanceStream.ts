import { KlineData, ExchangeType } from '../types';
import { getExchangeSymbol } from './binanceService';

type KlineCallback = (kline: KlineData) => void;

let ws: WebSocket | null = null;
let pingInterval: any = null;

export const subscribeToKline = (
  symbol: string, 
  interval: string, 
  callback: KlineCallback,
  exchange: ExchangeType = 'Binance'
) => {
  if (ws) {
    closeWebSocket();
  }

  // Get specific symbol format for the exchange
  const formattedSymbol = getExchangeSymbol(symbol, exchange);

  if (exchange === 'Binance') {
    const streamName = `${formattedSymbol.toLowerCase()}@kline_${interval}`;
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.e === 'kline') {
        const k = message.k;
        callback({
          time: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      }
    };
  }

  else if (exchange === 'Bybit') {
    ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
    
    let bybitInterval = interval;
    if (interval.endsWith('m')) bybitInterval = interval.replace('m', '');
    if (interval === '1h') bybitInterval = '60';
    if (interval === '1d') bybitInterval = 'D';

    ws.onopen = () => {
      const req = {
        op: 'subscribe',
        args: [`kline.${bybitInterval}.${formattedSymbol}`]
      };
      ws?.send(JSON.stringify(req));
      
      pingInterval = setInterval(() => {
         if (ws?.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({ op: 'ping' }));
         }
      }, 20000);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.topic && message.topic.startsWith('kline') && message.data) {
        const k = message.data[0];
        callback({
          time: k.start,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume),
        });
      }
    };
  }

  else if (exchange === 'MEXC') {
    ws = new WebSocket('wss://wbs.mexc.com/ws');
    
    ws.onopen = () => {
       let mexcInterval = 'Min15'; // Default
       if (interval === '1m') mexcInterval = 'Min1';
       if (interval === '5m') mexcInterval = 'Min5';
       if (interval === '15m') mexcInterval = 'Min15';
       if (interval === '30m') mexcInterval = 'Min30';
       if (interval === '1h') mexcInterval = 'Min60';
       if (interval === '4h') mexcInterval = 'Min240';
       if (interval === '1d') mexcInterval = 'Day1';

       const msg = {
          method: "SUBSCRIPTION",
          params: [`spot@public.kline.v3.api@${formattedSymbol}@${mexcInterval}`]
       };
       ws?.send(JSON.stringify(msg));

       pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'PING' }));
        }
       }, 30000);
    };

    ws.onmessage = (event) => {
       const message = JSON.parse(event.data);
       if (message.d && message.c && message.c.startsWith('spot@public.kline')) {
          const k = message.d.k;
          callback({
             time: k.t,
             open: parseFloat(k.o),
             high: parseFloat(k.h),
             low: parseFloat(k.l),
             close: parseFloat(k.c),
             volume: parseFloat(k.v)
          });
       }
    };
  }

  else if (exchange === 'Gate') {
      ws = new WebSocket('wss://api.gateio.ws/ws/v4/');
      
      ws.onopen = () => {
          const channel = "spot.candlesticks";
          const payload = {
              time: Math.floor(Date.now() / 1000),
              channel: channel,
              event: "subscribe",
              payload: [interval, formattedSymbol]
          };
          ws?.send(JSON.stringify(payload));
          
          pingInterval = setInterval(() => {
              if (ws?.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: "spot.pong" }));
              }
          }, 30000);
      };

      ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.event === 'update' && message.result) {
              const k = message.result;
              callback({
                  time: parseInt(k.t) * 1000, // Seconds to ms
                  open: parseFloat(k.o),
                  high: parseFloat(k.h),
                  low: parseFloat(k.l),
                  close: parseFloat(k.c),
                  volume: parseFloat(k.v) // Base volume, Gate doesn't stream quote vol easily in kline
              });
          }
      };
  }

  else if (exchange === 'OKX') {
      ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

      let okxInterval = interval;
      if (interval === '1h') okxInterval = '1H';
      if (interval === '4h') okxInterval = '4H';
      if (interval === '1d') okxInterval = '1D';

      ws.onopen = () => {
          const payload = {
              op: "subscribe",
              args: [{ channel: "candle" + okxInterval, instId: formattedSymbol }]
          };
          ws?.send(JSON.stringify(payload));

          pingInterval = setInterval(() => {
              if (ws?.readyState === WebSocket.OPEN) {
                  ws.send("ping");
              }
          }, 20000);
      };

      ws.onmessage = (event) => {
          // OKX might verify connection string, but for public it's simple
          if (event.data === 'pong') return;
          
          const message = JSON.parse(event.data);
          if (message.data && message.data.length > 0) {
              const k = message.data[0];
              callback({
                  time: parseInt(k.ts),
                  open: parseFloat(k.o),
                  high: parseFloat(k.h),
                  low: parseFloat(k.l),
                  close: parseFloat(k.c),
                  volume: parseFloat(k.volCcy)
              });
          }
      };
  }

  if (ws) {
      ws.onerror = (e) => console.log('WS Error', e);
  }
};

export const unsubscribeKline = () => {
  closeWebSocket();
};

const closeWebSocket = () => {
  if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
};