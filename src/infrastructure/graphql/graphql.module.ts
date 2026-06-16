import { Module } from '@nestjs/common';
import { GqlAppModule } from '../../graphql/graphql.module';

/**
 * Infrastructure GraphQL Facade Module
 *
 * Wraps the original GqlAppModule from src/graphql/.
 * Provides: Apollo GraphQL server, resolvers, scalars, dataloaders
 */
@Module({
  imports: [GqlAppModule],
  exports: [GqlAppModule],
})
export class InfrastructureGraphQLModule {}
