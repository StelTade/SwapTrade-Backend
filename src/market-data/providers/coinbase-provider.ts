import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import axios from 'axios';
import { MarketDataProvider, PriceUpdate } from '../interfaces/market-provider.interface';

@Injectable()
export class CoinbaseProvider implements MarketDataProvider {
  private readonly logger = new Logger(CoinbaseProvider.name);
  private ws: WebSocket | null = null;
  public readonly name = 'Coinbase';
  private priceUpdateCallbacks: ((data: PriceUpdate) => void)[] = [];
  private subscribedPairs = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(private readonly config: { apiKey?: string; url?: string }) {}

  async connect(): Promise<void> {
    try {
      const wsUrl = this.config.url || 'wss://ws-feed.exchange.coinbase.com';
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.logger.log('Connected to Coinbase WebSocket');
        this.reconnectAttempts = 0;
        this.sendSubscribeMessage();
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
        this.logger.error('Coinbase WebSocket error:', error);
      });

      this.ws.on('close', () => {
        this.logger.warn('Coinbase WebSocket connection closed');
        this.handleReconnect();
      });

    } catch (error) {
      this.logger.error('Failed to connect to Coinbase:', error);
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
    pairs.forEach(pair => this.subscribedPairs.add(pair));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribeMessage();
    }
  }

  async unsubscribeFromPairs(pairs: string[]): Promise<void> {
    pairs.forEach(pair => this.subscribedPairs.delete(pair));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendUnsubscribeMessage(pairs);
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onPriceUpdate(callback: (data: PriceUpdate) => void): void {
    this.priceUpdateCallbacks.push(callback);
  }

  private sendSubscribeMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      product_ids: Array.from(this.subscribedPairs),
      channels: ['ticker'],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    this.logger.log(`Subscribed to pairs: ${Array.from(this.subscribedPairs).join(', ')}`);
  }

  private sendUnsubscribeMessage(pairs: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      type: 'unsubscribe',
      product_ids: pairs,
      channels: ['ticker'],
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    this.logger.log(`Unsubscribed from pairs: ${pairs.join(', ')}`);
  }

  private handleMessage(message: any): void {
    if (message.type === 'ticker' && message.product_id) {
      const priceUpdate: PriceUpdate = {
        symbol: message.product_id,
        price: parseFloat(message.price),
        volume: parseFloat(message.volume_24h),
        timestamp: new Date(message.timestamp || Date.now()),
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
      const response = await axios.get(`https://api.exchange.coinbase.com/products/${symbol}/ticker`);
      const statsResponse = await axios.get(`https://api.exchange.coinbase.com/products/${symbol}/stats`);
      
      return {
        symbol: symbol,
        price: parseFloat(response.data.price),
        volume: parseFloat(statsResponse.data.volume_24h),
        timestamp: new Date(),
        source: this.name,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch REST data for ${symbol}:`, error);
      return null;
    }
  }
}
