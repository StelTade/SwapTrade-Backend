import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrivacyProfileService } from './services/privacy-profile.service';
import { EncryptedOrderService } from './services/encrypted-order.service';
import { PrivacyComplianceService } from './services/privacy-compliance.service';
import { PrivacyEncryptionService } from './services/privacy-encryption.service';
import { PrivacyZKPService } from './services/privacy-zkp.service';
import {
  CreatePrivacyProfileDto,
  UpdatePrivacyProfileDto,
  PrivacyProfileResponseDto,
} from './dto/privacy-profile.dto';
import {
  CreateEncryptedOrderDto,
  EncryptedOrderResponseDto,
  DecryptedOrderDto,
} from './dto/encrypted-order.dto';
import {
  CreatePrivacyAuditLogDto,
  PrivacyAuditLogResponseDto,
  RequestAuditDecryptionDto,
} from './dto/privacy-audit-log.dto';

@ApiTags('Privacy-Preserving Trading')
@Controller('api/v1/privacy')
export class PrivacyController {
  constructor(
    private readonly privacyProfileService: PrivacyProfileService,
    private readonly encryptedOrderService: EncryptedOrderService,
    private readonly complianceService: PrivacyComplianceService,
    private readonly encryptionService: PrivacyEncryptionService,
    private readonly zkpService: PrivacyZKPService,
  ) {}

  /**
   * Profile Management Endpoints
   */

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new privacy profile' })
  @ApiResponse({
    status: 201,
    description: 'Privacy profile created successfully',
    type: PrivacyProfileResponseDto,
  })
  async createProfile(
    @Request() req,
    @Body() createDto: CreatePrivacyProfileDto,
  ): Promise<PrivacyProfileResponseDto> {
    const userId = req.user?.id; // Assuming auth middleware sets this
    const profile = await this.privacyProfileService.createProfile(userId, createDto);
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Get('profiles/me')
  @ApiOperation({ summary: 'Get current user privacy profile' })
  @ApiResponse({
    status: 200,
    description: 'Privacy profile retrieved',
    type: PrivacyProfileResponseDto,
  })
  async getMyProfile(@Request() req): Promise<PrivacyProfileResponseDto> {
    const userId = req.user?.id;
    const profile = await this.privacyProfileService.getProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Privacy profile not found');
    }
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Get('profiles/:pseudonymousId')
  @ApiOperation({ summary: 'Get privacy profile by pseudonymous ID' })
  @ApiResponse({
    status: 200,
    description: 'Privacy profile retrieved',
    type: PrivacyProfileResponseDto,
  })
  async getProfile(@Param('pseudonymousId') pseudonymousId: string): Promise<PrivacyProfileResponseDto> {
    const profile = await this.privacyProfileService.getProfileByPseudonymousId(pseudonymousId);
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Put('profiles/:pseudonymousId')
  @ApiOperation({ summary: 'Update privacy profile' })
  @ApiResponse({
    status: 200,
    description: 'Privacy profile updated',
    type: PrivacyProfileResponseDto,
  })
  async updateProfile(
    @Param('pseudonymousId') pseudonymousId: string,
    @Body() updateDto: UpdatePrivacyProfileDto,
  ): Promise<PrivacyProfileResponseDto> {
    const profile = await this.privacyProfileService.updateProfile(pseudonymousId, updateDto);
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Post('profiles/:pseudonymousId/enable-anonymous')
  @ApiOperation({ summary: 'Enable anonymous trading mode' })
  @ApiResponse({
    status: 200,
    description: 'Anonymous mode enabled',
    type: PrivacyProfileResponseDto,
  })
  async enableAnonymousMode(
    @Param('pseudonymousId') pseudonymousId: string,
  ): Promise<PrivacyProfileResponseDto> {
    const profile = await this.privacyProfileService.enableAnonymousMode(pseudonymousId);
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Post('profiles/:pseudonymousId/disable-anonymous')
  @ApiOperation({ summary: 'Disable anonymous trading mode' })
  @ApiResponse({
    status: 200,
    description: 'Anonymous mode disabled',
    type: PrivacyProfileResponseDto,
  })
  async disableAnonymousMode(
    @Param('pseudonymousId') pseudonymousId: string,
  ): Promise<PrivacyProfileResponseDto> {
    const profile = await this.privacyProfileService.disableAnonymousMode(pseudonymousId);
    return this.privacyProfileService.toResponseDto(profile);
  }

  @Get('profiles/:pseudonymousId/stats')
  @ApiOperation({ summary: 'Get aggregated trading statistics' })
  async getAggregatedStats(@Param('pseudonymousId') pseudonymousId: string) {
    return await this.privacyProfileService.getAggregatedStats(pseudonymousId);
  }

  @Delete('profiles/:pseudonymousId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete privacy profile' })
  async deleteProfile(@Param('pseudonymousId') pseudonymousId: string): Promise<void> {
    await this.privacyProfileService.deleteProfile(pseudonymousId);
  }

  /**
   * Encrypted Order Management Endpoints
   */

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an encrypted anonymous order' })
  @ApiResponse({
    status: 201,
    description: 'Encrypted order created',
    type: EncryptedOrderResponseDto,
  })
  async createOrder(
    @Query('pseudonymousId') pseudonymousId: string,
    @Body() createDto: CreateEncryptedOrderDto,
  ): Promise<EncryptedOrderResponseDto> {
    const order = await this.encryptedOrderService.createOrder(pseudonymousId, createDto);
    return this.encryptedOrderService.toResponseDto(order);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get encrypted order (metadata only, details encrypted)' })
  @ApiResponse({
    status: 200,
    description: 'Encrypted order retrieved',
    type: EncryptedOrderResponseDto,
  })
  async getOrder(@Param('orderId') orderId: string): Promise<EncryptedOrderResponseDto> {
    const order = await this.encryptedOrderService.getOrderById(orderId);
    if (!order) {
      throw new NotFoundException('Encrypted order not found');
    }
    return this.encryptedOrderService.toResponseDto(order);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get encrypted orders for user' })
  @ApiResponse({
    status: 200,
    description: 'List of encrypted orders',
    type: [EncryptedOrderResponseDto],
  })
  async getUserOrders(
    @Query('pseudonymousId') pseudonymousId: string,
    @Query('status') status?: string,
  ): Promise<EncryptedOrderResponseDto[]> {
    const orders = await this.encryptedOrderService.getOrdersByPseudonymousId(
      pseudonymousId,
      status as any,
    );
    return orders.map((o) => this.encryptedOrderService.toResponseDto(o));
  }

  @Put('orders/:orderId')
  @ApiOperation({ summary: 'Update encrypted order' })
  async updateOrder(@Param('orderId') orderId: string, @Body() updateDto: any) {
    const order = await this.encryptedOrderService.updateOrder(orderId, updateDto);
    return this.encryptedOrderService.toResponseDto(order);
  }

  @Post('orders/:orderId/cancel')
  @ApiOperation({ summary: 'Cancel an encrypted order' })
  async cancelOrder(@Param('orderId') orderId: string) {
    const order = await this.encryptedOrderService.cancelOrder(orderId);
    return this.encryptedOrderService.toResponseDto(order);
  }

  @Delete('orders/:orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete encrypted order' })
  async deleteOrder(@Param('orderId') orderId: string): Promise<void> {
    await this.encryptedOrderService.deleteOrder(orderId);
  }

  @Get('orders/stats/execution')
  @ApiOperation({ summary: 'Get order execution statistics' })
  async getExecutionStats() {
    return await this.encryptedOrderService.getExecutionStats();
  }

  /**
   * Zero-Knowledge Proof Endpoints
   */

  @Post('proofs/balance-commitment')
  @ApiOperation({ summary: 'Create a balance commitment' })
  @ApiResponse({
    status: 201,
    description: 'Balance commitment created',
  })
  async createBalanceCommitment(@Body() body: { balance: string; nonce?: string }) {
    return this.zkpService.createBalanceCommitment(body.balance, body.nonce);
  }

  @Post('proofs/balance')
  @ApiOperation({ summary: 'Generate a ZKP proof for balance' })
  @ApiResponse({
    status: 201,
    description: 'ZKP balance proof generated',
  })
  async generateBalanceProof(
    @Body()
    body: {
      balance: string;
      coefficient: string;
      minAmount: string;
      challenge: string;
    },
  ) {
    return this.zkpService.generateBalanceProof(
      body.balance,
      body.coefficient,
      body.minAmount,
      body.challenge,
    );
  }

  @Post('proofs/balance/verify')
  @ApiOperation({ summary: 'Verify a ZKP balance proof' })
  async verifyBalanceProof(
    @Body()
    body: {
      commitment: string;
      proof: string;
      minAmount: string;
      challenge: string;
      coefficient: string;
    },
  ) {
    const isValid = this.zkpService.verifyBalanceProof(
      body.commitment,
      body.proof,
      body.minAmount,
      body.challenge,
      body.coefficient,
    );

    return { isValid };
  }

  @Post('proofs/range')
  @ApiOperation({ summary: 'Create a range proof (balance within range)' })
  async createRangeProof(
    @Body() body: { balance: string; minRange: string; maxRange: string },
  ) {
    return this.zkpService.createRangeProof(body.balance, body.minRange, body.maxRange);
  }

  @Get('proofs/challenge')
  @ApiOperation({ summary: 'Get a new server challenge for proof generation' })
  async getChallenge() {
    return { challenge: this.zkpService.generateServerChallenge() };
  }

  /**
   * Encryption/Decryption Endpoints (for order management)
   */

  @Post('encrypt')
  @ApiOperation({ summary: 'Encrypt data using AES-256-GCM' })
  async encryptData(
    @Body() body: { plaintext: string; key: string; nonce?: string },
  ) {
    const keyBuffer = Buffer.from(body.key, 'hex');
    const nonceBuffer = body.nonce ? Buffer.from(body.nonce, 'base64') : undefined;

    return this.encryptionService.encrypt(body.plaintext, keyBuffer, nonceBuffer);
  }

  @Post('decrypt')
  @ApiOperation({ summary: 'Decrypt data using AES-256-GCM' })
  async decryptData(
    @Body()
    body: {
      ciphertext: string;
      key: string;
      nonce: string;
      tag: string;
    },
  ) {
    const keyBuffer = Buffer.from(body.key, 'hex');
    const decrypted = this.encryptionService.decrypt(
      body.ciphertext,
      keyBuffer,
      body.nonce,
      body.tag,
    );

    return { plaintext: decrypted };
  }

  /**
   * Compliance and Audit Endpoints
   */

  @Post('audit-logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an audit log entry' })
  @ApiResponse({
    status: 201,
    description: 'Audit log created',
    type: PrivacyAuditLogResponseDto,
  })
  async createAuditLog(@Body() createDto: CreatePrivacyAuditLogDto): Promise<PrivacyAuditLogResponseDto> {
    const auditLog = await this.complianceService.createAuditLog(createDto);
    return this.complianceService.toResponseDto(auditLog);
  }

  @Get('audit-logs/:auditId')
  @ApiOperation({ summary: 'Get audit log entry' })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved',
    type: PrivacyAuditLogResponseDto,
  })
  async getAuditLog(@Param('auditId') auditId: string): Promise<PrivacyAuditLogResponseDto> {
    const auditLog = await this.complianceService.getAuditLogById(auditId);
    if (!auditLog) {
      throw new NotFoundException('Privacy audit log not found');
    }
    return this.complianceService.toResponseDto(auditLog);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs by user' })
  async getAuditLogs(
    @Query('pseudonymousIdHash') pseudonymousIdHash: string,
    @Query('action') action?: string,
  ) {
    const logs = await this.complianceService.getAuditLogsByUser(pseudonymousIdHash, action as any);
    return logs.map((l) => this.complianceService.toResponseDto(l));
  }

  @Get('audit-logs/high-risk')
  @ApiOperation({ summary: 'Get high-risk audit logs' })
  async getHighRiskLogs(@Query('level') level: 'HIGH' | 'CRITICAL' = 'HIGH') {
    const logs = await this.complianceService.getHighRiskLogs(level);
    return logs.map((l) => this.complianceService.toResponseDto(l));
  }

  @Post('audit-logs/:auditId/access')
  @ApiOperation({ summary: 'Log access to audit record' })
  async logAuditAccess(
    @Param('auditId') auditId: string,
    @Body()
    accessLog: {
      accessedBy: string;
      reason: string;
      approved: boolean;
      approvedBy?: string;
    },
  ) {
    const updated = await this.complianceService.logAuditAccess(auditId, {
      ...accessLog,
      accessedAt: new Date(),
    });
    return this.complianceService.toResponseDto(updated);
  }

  @Get('compliance-report')
  @ApiOperation({ summary: 'Generate compliance report' })
  async getComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.complianceService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('compliance-report/export')
  @ApiOperation({ summary: 'Export audit logs for compliance' })
  async exportAuditLogs(@Query('pseudonymousIdHash') pseudonymousIdHash?: string) {
    return await this.complianceService.exportAuditLogs(pseudonymousIdHash);
  }

  /**
   * Health and Stats Endpoints
   */

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get privacy system overview statistics' })
  async getSystemStats() {
    const [totalProfiles, totalOrders, totalAudits] = await Promise.all([
      this.privacyProfileService.countAnonymousUsers(),
      this.encryptedOrderService.countTotalOrders(),
      this.complianceService.countTotalAuditLogs(),
    ]);

    return {
      anonymousProfiles: totalProfiles,
      encryptedOrders: totalOrders,
      auditLogs: totalAudits,
      timestamp: new Date(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check privacy service health' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        encryption: 'operational',
        zkp: 'operational',
        audit: 'operational',
      },
    };
  }
}