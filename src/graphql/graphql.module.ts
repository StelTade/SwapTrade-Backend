import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { join } from 'path';
import { BigIntScalar } from './scalars/bigint.scalar';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { UserModule } from '../user/user.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      installSubscriptionHandlers: true,
      path: '/graphql',
      // Exposes the underlying Express request on the GraphQL execution
      // context so guards/decorators (e.g. GqlJwtAuthGuard,
      // CurrentGqlUser) can read it. Previously absent — meant no
      // resolver in this app could have done JWT auth via GraphQL.
      context: ({ req }: { req: any }) => ({ req }),
      subscriptions: {
        'graphql-ws': true,
      } as any,
    }),
    UserModule,
    OrdersModule,
  ],
  providers: [BigIntScalar, DateTimeScalar],
})
export class GqlAppModule {}
