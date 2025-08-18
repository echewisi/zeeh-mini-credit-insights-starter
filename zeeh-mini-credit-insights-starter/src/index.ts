import { createServer } from './server.js';

const port = process.env.PORT || 3000;
const app = createServer();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
});
