// scripts/config-docs.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ConfigDocumentationGenerator } = require('../dist/config/config-documentation.generator');

async function generateDocs() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const docGenerator = app.get(ConfigDocumentationGenerator);

  docGenerator.saveMarkdown();
  console.log('Configuration documentation generated: CONFIG_DOCUMENTATION.md');

  await app.close();
}

generateDocs().catch(console.error);