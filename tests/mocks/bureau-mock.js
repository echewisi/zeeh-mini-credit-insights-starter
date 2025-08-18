import http from 'http';

const port = 4000;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/credit/check') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      // Simple rate-limit simulation
      if (Math.random() < 0.05) {
        res.statusCode = 429;
        return res.end(JSON.stringify({ error: 'rate_limited' }));
      }
      res.end(JSON.stringify({
        score: 624,
        risk_band: "MEDIUM",
        enquiries_6m: 3,
        defaults: 0,
        open_loans: 2,
        trade_lines: [
          {"type":"BNPL","status":"OPEN","limit":150000,"balance":42000},
          {"type":"SALARY_ADVANCE","status":"CLOSED","limit":100000,"balance":0}
        ]
      }));
    });
  } else {
    res.statusCode = 404;
    res.end('not found');
  }
});

server.listen(port, () => console.log(`Mock bureau on :${port}`));
