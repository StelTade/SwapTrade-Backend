import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface ParticipantInfo {
  userId: string;
  socketId: string;
  joinedAt: Date;
  hasBid: boolean;
  lastActivity: Date;
}

/**
 * Tracks live WebSocket presence per auction room.
 * Stored in-process memory; for multi-instance deployments
 * the BidPubSubService propagates join/leave events so each
 * node can maintain a local mirror for its own sockets.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  /**
   * auctionId → socketId → ParticipantInfo
   */
  private readonly rooms = new Map<string, Map<string, ParticipantInfo>>();

  /**
   * socketId → set of auctionIds (for fast cleanup on disconnect)
   */
  private readonly socketRooms = new Map<string, Set<string>>();

  // ──────────────────────────────────────────────────────────────────────────
  // Join / Leave
  // ──────────────────────────────────────────────────────────────────────────

  join(auctionId: string, socketId: string, userId: string): void {
    if (!this.rooms.has(auctionId)) {
      this.rooms.set(auctionId, new Map());
    }

    this.rooms.get(auctionId)!.set(socketId, {
      userId,
      socketId,
      joinedAt: new Date(),
      hasBid: false,
      lastActivity: new Date(),
    });

    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
    this.socketRooms.get(socketId)!.add(auctionId);

    this.logger.debug(
      `Socket ${socketId} (user ${userId}) joined auction ${auctionId}. Room size: ${this.rooms.get(auctionId)!.size}`,
    );
  }

  leave(auctionId: string, socketId: string): void {
    this.rooms.get(auctionId)?.delete(socketId);
    this.socketRooms.get(socketId)?.delete(auctionId);

    // Clean up empty room
    if (this.rooms.get(auctionId)?.size === 0) {
      this.rooms.delete(auctionId);
    }
  }

  /**
   * Called on socket disconnect — removes from all rooms at once.
   * Returns list of affected auctionIds for broadcast.
   */
  disconnectSocket(socketId: string): string[] {
    const auctionIds = Array.from(this.socketRooms.get(socketId) ?? []);

    for (const auctionId of auctionIds) {
      this.leave(auctionId, socketId);
    }

    this.socketRooms.delete(socketId);

    this.logger.debug(
      `Socket ${socketId} disconnected. Removed from ${auctionIds.length} auctions.`,
    );

    return auctionIds;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mark as bidder
  // ──────────────────────────────────────────────────────────────────────────

  markBidPlaced(auctionId: string, socketId: string): void {
    const participant = this.rooms.get(auctionId)?.get(socketId);
    if (participant) {
      participant.hasBid = true;
      participant.lastActivity = new Date();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────────────────────

  getParticipantCount(auctionId: string): number {
    return this.rooms.get(auctionId)?.size ?? 0;
  }

  getActiveBidderCount(auctionId: string): number {
    const room = this.rooms.get(auctionId);
    if (!room) return 0;
    let count = 0;
    room.forEach((p) => { if (p.hasBid) count++; });
    return count;
  }

  getParticipants(auctionId: string): ParticipantInfo[] {
    return Array.from(this.rooms.get(auctionId)?.values() ?? []);
  }

  isPresent(auctionId: string, userId: string): boolean {
    const room = this.rooms.get(auctionId);
    if (!room) return false;
    for (const p of room.values()) {
      if (p.userId === userId) return true;
    }
    return false;
  }

  getSocketIdsForUser(auctionId: string, userId: string): string[] {
    const room = this.rooms.get(auctionId);
    if (!room) return [];
    const ids: string[] = [];
    room.forEach((p) => { if (p.userId === userId) ids.push(p.socketId); });
    return ids;
  }
}