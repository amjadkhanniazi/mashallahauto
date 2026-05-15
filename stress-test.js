import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate    = new Rate('error_rate');
const pageLoadTime = new Trend('page_load_time', true);
const totalErrors  = new Counter('total_errors');

// ─── Test Configuration ───────────────────────────────────────────────────────
// This runs 4 stages:
//  1. Ramp up   : 0  → 50  users over 1 minute   (normal load)
//  2. Stay      : 50 users for 2 minutes           (sustained load)
//  3. Spike     : 50 → 200 users over 1 minute    (stress / spike)
//  4. Ramp down : 200 → 0  users over 1 minute    (recovery check)

export const options = {
  stages: [
    { duration: '1m', target: 50  },   // Stage 1: ramp up to 50 users
    { duration: '2m', target: 50  },   // Stage 2: hold 50 users
    { duration: '1m', target: 200 },   // Stage 3: spike to 200 users
    { duration: '1m', target: 0   },   // Stage 4: ramp down
  ],

  // ── Pass/Fail Thresholds ──────────────────────────────────────────────────
  thresholds: {
    // 95% of requests must complete under 3 seconds
    http_req_duration: ['p(95)<3000'],
    // Error rate must stay below 5%
    error_rate: ['rate<0.05'],
    // 99% of requests must complete under 5 seconds
    'http_req_duration{type:homepage}': ['p(99)<5000'],
  },
};

const BASE_URL = 'https://mashallahautos.com';

// ─── Main Test Function (runs once per virtual user per iteration) ─────────────
export default function () {

  // ── 1. Hit the Homepage ───────────────────────────────────────────────────
  const homeRes = http.get(BASE_URL + '/', {
    tags: { type: 'homepage' },
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  // Record load time
  pageLoadTime.add(homeRes.timings.duration);

  // Check response
  const homeOk = check(homeRes, {
    '✅ Homepage status is 200':        (r) => r.status === 200,
    '✅ Response time < 2s':            (r) => r.timings.duration < 2000,
    '✅ Contains site title':           (r) => r.body.includes('MashAllah Autos'),
    '✅ Contains canonical tag':        (r) => r.body.includes('canonical'),
    '✅ Body is not empty':             (r) => r.body.length > 500,
  });

  if (!homeOk) {
    errorRate.add(1);
    totalErrors.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(1); // 1 second pause between requests (simulates real user reading)

  // ── 2. Hit robots.txt ─────────────────────────────────────────────────────
  const robotsRes = http.get(BASE_URL + '/robots.txt', {
    tags: { type: 'robots' },
  });

  check(robotsRes, {
    '✅ robots.txt is accessible': (r) => r.status === 200,
    '✅ robots.txt has content':   (r) => r.body.includes('User-agent'),
  });

  sleep(0.5);

  // ── 3. Hit sitemap.xml ────────────────────────────────────────────────────
  const sitemapRes = http.get(BASE_URL + '/sitemap.xml', {
    tags: { type: 'sitemap' },
  });

  check(sitemapRes, {
    '✅ sitemap.xml is accessible': (r) => r.status === 200,
    '✅ sitemap.xml has URLs':      (r) => r.body.includes('mashallahautos.com'),
  });

  sleep(0.5);

  // ── 4. Simulate WhatsApp link click (just a redirect check) ───────────────
  // We don't actually follow it, just verify the homepage link resolves
  const waLinkCheck = http.get(BASE_URL + '/', {
    tags: { type: 'return_visit' },
  });

  check(waLinkCheck, {
    '✅ Return visit still 200': (r) => r.status === 200,
  });

  sleep(1);
}

// ─── Summary Report printed after test ends ───────────────────────────────────
export function handleSummary(data) {
  const passed = data.metrics.http_req_duration.values['p(95)'] < 3000;
  const errPct = (data.metrics.error_rate.values.rate * 100).toFixed(2);
  const p95    = data.metrics.http_req_duration.values['p(95)'].toFixed(0);
  const p99    = data.metrics.http_req_duration.values['p(99)'].toFixed(0);
  const avg    = data.metrics.http_req_duration.values['avg'].toFixed(0);
  const reqs   = data.metrics.http_reqs.values.count;
  const rps    = data.metrics.http_reqs.values.rate.toFixed(2);

  const report = `
╔══════════════════════════════════════════════════════════════╗
║           MASHALLAHAUTOS.COM — STRESS TEST REPORT           ║
╠══════════════════════════════════════════════════════════════╣
║  Overall Result : ${passed ? '✅  PASSED' : '❌  FAILED'}                              ║
╠══════════════════════════════════════════════════════════════╣
║  TRAFFIC SUMMARY                                            ║
║  Total Requests  : ${String(reqs).padEnd(10)}                               ║
║  Requests/sec    : ${String(rps).padEnd(10)}                               ║
╠══════════════════════════════════════════════════════════════╣
║  RESPONSE TIMES                                             ║
║  Average         : ${String(avg + 'ms').padEnd(10)}                               ║
║  95th percentile : ${String(p95 + 'ms').padEnd(10)}  (threshold: <3000ms)     ║
║  99th percentile : ${String(p99 + 'ms').padEnd(10)}                               ║
╠══════════════════════════════════════════════════════════════╣
║  RELIABILITY                                                ║
║  Error Rate      : ${String(errPct + '%').padEnd(10)}  (threshold: <5%)         ║
╚══════════════════════════════════════════════════════════════╝

HOW TO READ THIS:
  p95 < 1000ms  → Excellent — handles load very well
  p95 < 2000ms  → Good — acceptable for a static site
  p95 < 3000ms  → Marginal — monitor under real traffic
  p95 > 3000ms  → Problem — Nginx or network bottleneck
  Error Rate > 5% → Container is crashing or rate limiting

`;

  // Write to file and print to console
  return {
    'stress-test-report.txt': report,
    stdout: report,
  };
}
