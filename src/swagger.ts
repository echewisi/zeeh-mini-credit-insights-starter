import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';

export function mountSwagger(app: Express) {
  const docPath = path.join(process.cwd(), 'openapi.yaml');
  const spec = YAML.load(docPath);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
