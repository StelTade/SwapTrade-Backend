// src/config/config-documentation.generator.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from './config.service';
import * as fs from 'fs';
import * as path from 'path';

interface ConfigDocumentation {
  environment: string;
  timestamp: string;
  sections: {
    [key: string]: {
      description: string;
      variables: {
        name: string;
        value: any;
        default: any;
        description: string;
        required: boolean;
        sensitive: boolean;
      }[];
    };
  };
}

@Injectable()
export class ConfigDocumentationGenerator {
  private readonly logger = new Logger(ConfigDocumentationGenerator.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate comprehensive configuration documentation
   */
  generateDocumentation(): ConfigDocumentation {
    const doc: ConfigDocumentation = {
      environment: this.configService.getEnv(),
      timestamp: new Date().toISOString(),
      sections: {
        app: {
          description: 'Application configuration',
          variables: [
            {
              name: 'NODE_ENV',
              value: this.configService.app.nodeEnv,
              default: 'development',
              description: 'Application environment',
              required: false,
              sensitive: false,
            },
            {
              name: 'PORT',
              value: this.configService.app.port,
              default: 3000,
              description: 'Application port',
              required: false,
              sensitive: false,
            },
            {
              name: 'HOST',
              value: this.configService.app.host,
              default: 'localhost',
              description: 'Application host',
              required: false,
              sensitive: false,
            },
            {
              name: 'CORS_ORIGIN',
              value: this.configService.app.cors?.origin,
              default: '*',
              description: 'CORS allowed origins',
              required: false,
              sensitive: false,
            },
          ],
        },
        database: {
          description: 'Database configuration',
          variables: [
            {
              name: 'DB_TYPE',
              value: this.configService.database.type,
              default: 'sqlite',
              description: 'Database type',
              required: false,
              sensitive: false,
            },
            {
              name: 'DB_HOST',
              value: this.configService.database.host,
              default: null,
              description: 'Database host',
              required: false,
              sensitive: false,
            },
            {
              name: 'DB_PORT',
              value: this.configService.database.port,
              default: null,
              description: 'Database port',
              required: false,
              sensitive: false,
            },
            {
              name: 'DB_NAME',
              value: this.configService.database.database,
              default: 'swaptrade.db',
              description: 'Database name',
              required: true,
              sensitive: false,
            },
            {
              name: 'DB_USERNAME',
              value: this.configService.database.username ? '[SET]' : null,
              default: null,
              description: 'Database username',
              required: false,
              sensitive: true,
            },
            {
              name: 'DB_PASSWORD',
              value: this.configService.database.password ? '[SET]' : null,
              default: null,
              description: 'Database password',
              required: false,
              sensitive: true,
            },
          ],
        },
        redis: {
          description: 'Redis configuration',
          variables: [
            {
              name: 'REDIS_HOST',
              value: this.configService.redis.host,
              default: 'localhost',
              description: 'Redis host',
              required: false,
              sensitive: false,
            },
            {
              name: 'REDIS_PORT',
              value: this.configService.redis.port,
              default: 6379,
              description: 'Redis port',
              required: false,
              sensitive: false,
            },
            {
              name: 'REDIS_PASSWORD',
              value: this.configService.redis.password ? '[SET]' : null,
              default: null,
              description: 'Redis password',
              required: false,
              sensitive: true,
            },
          ],
        },
        auth: {
          description: 'Authentication configuration',
          variables: [
            {
              name: 'JWT_SECRET',
              value: '[REDACTED]',
              default: null,
              description: 'JWT signing secret',
              required: true,
              sensitive: true,
            },
            {
              name: 'JWT_EXPIRES_IN',
              value: this.configService.auth.jwtExpiresIn,
              default: 3600,
              description: 'JWT expiration time in seconds',
              required: false,
              sensitive: false,
            },
          ],
        },
        features: {
          description: 'Feature flags',
          variables: [
            {
              name: 'FEATURE_ADVANCED_CACHING',
              value: this.configService.isFeatureEnabled('enableAdvancedCaching'),
              default: true,
              description: 'Enable advanced caching features',
              required: false,
              sensitive: false,
            },
            {
              name: 'FEATURE_QUEUE_MONITORING',
              value: this.configService.isFeatureEnabled('enableQueueMonitoring'),
              default: true,
              description: 'Enable queue monitoring',
              required: false,
              sensitive: false,
            },
            {
              name: 'FEATURE_HOT_RELOAD',
              value: this.configService.isFeatureEnabled('enableHotReload'),
              default: false,
              description: 'Enable configuration hot reload',
              required: false,
              sensitive: false,
            },
          ],
        },
      },
    };

    return doc;
  }

  /**
   * Save documentation to file
   */
  saveDocumentation(filePath?: string): void {
    const doc = this.generateDocumentation();
    const outputPath = filePath || path.join(process.cwd(), 'config-documentation.json');

    try {
      fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2));
      this.logger.log(`Configuration documentation saved to ${outputPath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration documentation:', error);
    }
  }

  /**
   * Generate Markdown documentation
   */
  generateMarkdown(): string {
    const doc = this.generateDocumentation();
    let markdown = `# Configuration Documentation\n\n`;
    markdown += `**Environment:** ${doc.environment}\n\n`;
    markdown += `**Generated:** ${doc.timestamp}\n\n`;

    for (const [sectionName, section] of Object.entries(doc.sections)) {
      markdown += `## ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}\n\n`;
      markdown += `${section.description}\n\n`;
      markdown += `| Variable | Value | Default | Required | Sensitive | Description |\n`;
      markdown += `|----------|-------|---------|----------|-----------|-------------|\n`;

      for (const variable of section.variables) {
        const value = variable.sensitive ? '[REDACTED]' : (variable.value || 'null');
        const required = variable.required ? 'Yes' : 'No';
        const sensitive = variable.sensitive ? 'Yes' : 'No';
        markdown += `| ${variable.name} | ${value} | ${variable.default} | ${required} | ${sensitive} | ${variable.description} |\n`;
      }

      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Save Markdown documentation to file
   */
  saveMarkdown(filePath?: string): void {
    const markdown = this.generateMarkdown();
    const outputPath = filePath || path.join(process.cwd(), 'CONFIG_DOCUMENTATION.md');

    try {
      fs.writeFileSync(outputPath, markdown);
      this.logger.log(`Configuration documentation saved to ${outputPath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration documentation:', error);
    }
  }
}