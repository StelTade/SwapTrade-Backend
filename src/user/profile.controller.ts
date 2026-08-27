import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

import { ProfileService } from './services/profile.service';
import { LinkedWalletService } from './services/linked-wallet.service';
import { KycDocumentService } from './services/kyc-document.service';
import { UserService } from './user.service';

import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AddLinkedWalletDto,
  SetPrimaryWalletDto,
} from './dto/linked-wallet.dto';
import { UploadKycDocumentDto } from './dto/kyc-document.dto';
import {
  ToggleNotificationDto,
  UpdatePreferencesDto,
} from './dto/user-preferences.dto';
import { KycDocumentType } from './entities/kyc-document.entity';

/**
 * User Profile & KYC Management controller.
 *
 * All endpoints are authenticated and scoped to the current user unless
 * noted otherwise.
 */
@ApiTags('identity/user-profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('identity/user-profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(
    private readonly profileService: ProfileService,
    private readonly linkedWalletService: LinkedWalletService,
    private readonly kycDocumentService: KycDocumentService,
    private readonly userService: UserService,
  ) {}

  // ─── Profile CRUD ─────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiErrorResponses()
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.profileService.getProfile(user.userId);
  }

  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiErrorResponses()
  updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user profile by ID (admin or self)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiErrorResponses()
  getProfileById(@Param('userId') userId: string) {
    return this.profileService.getProfile(userId);
  }

  // ─── Linked Wallets ───────────────────────────────────────────────────

  @Get('me/wallets')
  @ApiOperation({ summary: 'List all linked wallets for the current user' })
  @ApiResponse({ status: 200, description: 'List of linked wallets' })
  @ApiErrorResponses()
  getMyWallets(@CurrentUser() user: JwtPayload) {
    return this.linkedWalletService.getWalletsForUser(user.userId);
  }

  @Post('me/wallets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a new wallet address' })
  @ApiResponse({ status: 201, description: 'Wallet linked' })
  @ApiErrorResponses()
  addWallet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddLinkedWalletDto,
  ) {
    return this.linkedWalletService.addWallet(
      user.userId,
      dto.address,
      dto.chain,
      dto.label,
      dto.isPrimary,
    );
  }

  @Delete('me/wallets/:walletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a linked wallet address' })
  @ApiParam({ name: 'walletId', description: 'Linked wallet UUID' })
  @ApiResponse({ status: 204, description: 'Wallet removed' })
  @ApiErrorResponses()
  removeWallet(
    @CurrentUser() user: JwtPayload,
    @Param('walletId') walletId: string,
  ) {
    return this.linkedWalletService.removeWallet(walletId, user.userId);
  }

  @Put('me/wallets/primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a wallet as the primary wallet' })
  @ApiResponse({ status: 200, description: 'Primary wallet updated' })
  @ApiErrorResponses()
  setPrimaryWallet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetPrimaryWalletDto,
  ) {
    return this.linkedWalletService.setPrimaryWallet(
      dto.walletId,
      user.userId,
    );
  }

  // ─── KYC Documents ────────────────────────────────────────────────────

  @Post('me/kyc/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a KYC document (encrypted at rest)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentType', 'file'],
      properties: {
        documentType: { type: 'string', enum: Object.values(KycDocumentType) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded and encrypted' })
  @ApiErrorResponses()
  async uploadKycDocument(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() dto: UploadKycDocumentDto,
  ) {
    if (!file) {
      throw new (await import('@nestjs/common')).BadRequestException(
        'No file provided',
      );
    }

    return this.kycDocumentService.uploadDocument(
      user.userId,
      file.buffer,
      dto.documentType,
      file.originalname,
      file.mimetype,
    );
  }

  @Get('me/kyc/documents')
  @ApiOperation({ summary: 'List all KYC documents for the current user' })
  @ApiResponse({ status: 200, description: 'List of KYC documents' })
  @ApiErrorResponses()
  getMyKycDocuments(@CurrentUser() user: JwtPayload) {
    return this.kycDocumentService.getDocumentsForUser(user.userId);
  }

  @Get('me/kyc/status')
  @ApiOperation({ summary: 'Get current KYC verification status' })
  @ApiResponse({ status: 200, description: 'KYC status and documents' })
  @ApiErrorResponses()
  async getMyKycStatus(@CurrentUser() user: JwtPayload) {
    const profile = await this.profileService.getProfile(user.userId);
    const documents = await this.kycDocumentService.getDocumentsForUser(
      user.userId,
    );

    return {
      kycStatus: profile.kycStatus,
      documents,
      lastUpdated: profile.updatedAt,
    };
  }

  // ─── Preferences ──────────────────────────────────────────────────────

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get user preferences and notification settings' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  @ApiErrorResponses()
  getMyPreferences(@CurrentUser() user: JwtPayload) {
    return this.profileService.getPreferences(user.userId);
  }

  @Patch('me/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user preferences (bulk)' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @ApiErrorResponses()
  updateMyPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.profileService.updatePreferences(user.userId, dto);
  }

  @Patch('me/preferences/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle a single notification preference' })
  @ApiResponse({
    status: 200,
    description: 'Notification preference toggled',
  })
  @ApiErrorResponses()
  toggleNotification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ToggleNotificationDto,
  ) {
    return this.profileService.toggleNotification(
      user.userId,
      dto.key,
      dto.value,
    );
  }
}
