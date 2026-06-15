import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Events Infrastructure Module
 * Provides centralized event bus for pub/sub communication
 * Replaces direct imports and circular dependencies
 */

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Emit events asynchronously (non-blocking)
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseErrors: false,
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventsModule {}
