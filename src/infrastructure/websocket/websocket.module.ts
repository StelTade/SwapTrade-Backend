import { Module } from '@nestjs/common';
import { WebSocketModule as OriginalWebSocketModule } from '../../websocket/websocket.module';

/**
 * Infrastructure WebSocket Facade Module
 *
 * Wraps the original WebSocketModule from src/websocket/.
 * Provides: WebSocketService, WebSocketEvents, StreamManagerService,
 *           ConnectionManagerService, RealtimeEventsService
 */
@Module({
  imports: [OriginalWebSocketModule],
  exports: [OriginalWebSocketModule],
})
export class InfrastructureWebSocketModule {}
