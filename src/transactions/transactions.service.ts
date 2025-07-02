import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';


@Injectable()
export class TransactionsService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async create(createTransactionDto: CreateTransactionDto) {
    // ... transaction creation logic ...
    // For demonstration, assume createTransactionDto.userId is the recipient
    await this.notificationsService.createAndBroadcast(
      createTransactionDto.userId.toString(),
      NotificationType.OfferCreated,
      { transaction: createTransactionDto },
    );
    return 'This action adds a new transaction and notifies the user';
  }

  findAll() {
    return `This action returns all transactions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} transaction`;
  }

  update(id: number, updateTransactionDto: UpdateTransactionDto) {
    return `This action updates a #${id} transaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} transaction`;
  }
}
