/**
 * Build-time values substituted by webpack's DefinePlugin (webpack.config.mjs).
 * Only these keys exist in the browser bundle; there is no real `process` object.
 */
declare const process: {
  env: {
    readonly NODE_ENV?: 'development' | 'production';
    readonly PVO_DATA_SOURCE?: string;
    readonly PVO_API_BASE_URL?: string;
    readonly PVO_MOCK_LATENCY_MS?: string;
  };
};

/** Stylesheets are handled by css-loader + mini-css-extract-plugin. */
declare module '*.css';
