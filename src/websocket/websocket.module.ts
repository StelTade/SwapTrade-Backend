import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketService } from './services/websocket.service';
import { TradingGateway } from './gateway/trading.gateway';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { WebSocketEvents } from './events/websocket.events';
import { WebSocketRateLimitMiddleware } from './middleware/websocket-rate-limit.middleware';
import { PrometheusService } from '../common/monitoring/services/prometheus.service';
import { StructuredLoggerService } from '../common/monitoring/services/structured-logger.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' }
    })
  ],
  providers: [
    WebSocketService,
    WebSocketAuthGuard,
    WebSocketEvents,
    WebSocketRateLimitMiddleware,
    PrometheusService,
    StructuredLoggerService
  ],
  exports: [WebSocketService, WebSocketEvents]
})
export class WebSocketModule {}
