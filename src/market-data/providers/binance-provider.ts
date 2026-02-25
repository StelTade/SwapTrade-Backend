import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import axios from 'axios';
import { MarketDataProvider, PriceUpdate } from '../interfaces/market-provider.interface';

@Injectable()
export class BinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(BinanceProvider.name);
  private ws: WebSocket | null = null;
  public readonly name = 'Binance';
  private priceUpdateCallbacks: ((data: PriceUpdate) => void)[] = [];
  private subscribedPairs = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(private readonly config: { apiKey?: string; url?: string }) {}

  async connect(): Promise<void> {
    try {
      const wsUrl = this.config.url || 'wss://stream.binance.com:9443/ws';
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.logger.log('Connected to Binance WebSocket');
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('Binance WebSocket error:', error);
      });

      this.ws.on('close', () => {
        this.logger.warn('Binance WebSocket connection closed');
        this.handleReconnect();
      });

    } catch (error) {
      this.logger.error('Failed to connect to Binance:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async subscribeToPairs(pairs: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: pairs.map(pair => `${pair.toLowerCase()}@ticker`),
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    
    pairs.forEach(pair => this.subscribedPairs.add(pair));
    this.logger.log(`Subscribed to pairs: ${pairs.join(', ')}`);
  }

  async unsubscribeFromPairs(pairs: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: pairs.map(pair => `${pair.toLowerCase()}@ticker`),
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    
    pairs.forEach(pair => this.subscribedPairs.delete(pair));
    this.logger.log(`Unsubscribed from pairs: ${pairs.join(', ')}`);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onPriceUpdate(callback: (data: PriceUpdate) => void): void {
    this.priceUpdateCallbacks.push(callback);
  }

  private handleMessage(message: any): void {
    if (message.e === '24hrTicker') {
      const priceUpdate: PriceUpdate = {
        symbol: message.s,
        price: parseFloat(message.c),
        volume: parseFloat(message.v),
        timestamp: new Date(message.E),
        source: this.name,
      };

      this.priceUpdateCallbacks.forEach(callback => callback(priceUpdate));
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(async () => {
        try {
          await this.connect();
          if (this.subscribedPairs.size > 0) {
            await this.subscribeToPairs(Array.from(this.subscribedPairs));
          }
        } catch (error) {
          this.logger.error('Reconnection failed:', error);
        }
      }, this.reconnectDelay);
    } else {
      this.logger.error('Max reconnection attempts reached');
    }
  }

  async getRestMarketData(symbol: string): Promise<PriceUpdate | null> {
    try {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const data = response.data;
      
      return {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        timestamp: new Date(data.closeTime),
        source: this.name,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch REST data for ${symbol}:`, error);
      return null;
    }
  }
}
