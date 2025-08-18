import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function mountSwagger(app: Express) {
  const docPath = path.join(__dirname, '../openapi.yaml');
  const spec = YAML.load(docPath);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
