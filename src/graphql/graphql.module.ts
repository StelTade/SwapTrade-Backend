import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver } from '@nestjs/apollo';
import { join } from 'path';
import { BigIntScalar } from './scalars/bigint.scalar';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { UserModule } from '../user/user.module';
import { TradingModule } from '../trading/trading.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { UserResolver } from './resolvers/user.resolver';
import { TradeResolver } from './resolvers/trade.resolver';
import { PortfolioResolver } from './resolvers/portfolio.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloFederationDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      installSubscriptionHandlers: true,
      path: '/graphql',
      subscriptions: {
        'graphql-ws': true,
      } as any,
      fieldResolverEnhancers: ['guards', 'interceptors'],
    } as any),
    UserModule,
    TradingModule,
    PortfolioModule,
  ],
  providers: [BigIntScalar, DateTimeScalar, UserResolver, TradeResolver, PortfolioResolver],
})
export class GqlAppModule {}
