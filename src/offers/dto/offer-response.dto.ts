import { OfferStatus } from '../enums/offer-status.enum';

export class OfferResponseDto {
  id: string;
  offeredAssetId: number;
  requestedAssetId: number;
  initiatorId: number;
  recipientId: number;
  status: OfferStatus;
  offeredAmount?: number;
  requestedAmount?: number;
  message?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Additional fields for enhanced responses
  initiator?: {
    id: number;
    firstname: string;
    lastname?: string;
    email: string;
  };
  
  recipient?: {
    id: number;
    firstname: string;
    lastname?: string;
    email: string;
  };
  
  offeredAsset?: {
    id: number;
    name: string;
    cryptocurrency?: {
      id: number;
      symbol: string;
      name: string;
    };
  };
  
  requestedAsset?: {
    id: number;
    name: string;
    cryptocurrency?: {
      id: number;
      symbol: string;
      name: string;
    };
  };
} 