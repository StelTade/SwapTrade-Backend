import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { join } from 'path';
import { BigIntScalar } from './scalars/bigint.scalar';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      installSubscriptionHandlers: true,
      path: '/graphql',
      subscriptions: {
        'graphql-ws': true,
      } as any,
    }),
    UserModule,
  ],
  providers: [BigIntScalar, DateTimeScalar],
})
export class GqlAppModule {}
