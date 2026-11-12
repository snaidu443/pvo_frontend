/**
 * Runtime configuration. webpack's DefinePlugin replaces the `process.env.PVO_*`
 * reads below with the values from the environment / .env files at build time
 * (see webpack.config.mjs and .env.example).
 */
const source = process.env.PVO_DATA_SOURCE === 'api' ? 'api' : 'mock';
const baseUrl = (process.env.PVO_API_BASE_URL || '').replace(/\/+$/, '');
const latency = Number(process.env.PVO_MOCK_LATENCY_MS || 150);

if (source === 'api' && !/^https:\/\//.test(baseUrl) && !/^http:\/\/localhost(:\d+)?/.test(baseUrl)) {
  // Fail closed: refuse to talk to a non-TLS remote API.
  throw new Error('PVO_API_BASE_URL must be an https:// URL (http://localhost is allowed for development).');
}

export const env = {
  dataSource: source as 'mock' | 'api',
  apiBaseUrl: baseUrl,
  mockLatencyMs: Number.isFinite(latency) && latency >= 0 ? latency : 150
} as const;

export const isMock = () => env.dataSource === 'mock';
