/**
 * webpack build for the Policy Value Optimizer front end.
 *
 *   npm run dev      webpack-dev-server on http://localhost:3000 (live reload)
 *   npm run build    type-check, then production bundle into dist/
 *
 * Environment: only variables prefixed PVO_ are exposed to the browser bundle
 * (see .env.example). They are read from the shell, then .env, .env.local,
 * .env.<mode>, .env.<mode>.local (later files win). Never put secrets in them.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const root = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_VARS = ['PVO_DATA_SOURCE', 'PVO_API_BASE_URL', 'PVO_MOCK_LATENCY_MS'];

/** Minimal .env reader (KEY=value lines, # comments) so no dotenv package is needed. */
function readEnvFiles(mode) {
  const values = {};
  for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trimStart().startsWith('#')) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return values;
}

export default (_env, argv) => {
  const mode = argv.mode === 'production' ? 'production' : 'development';
  const isProd = mode === 'production';
  const fileVars = readEnvFiles(mode);
  const defined = Object.fromEntries(
    PUBLIC_VARS.map(key => [`process.env.${key}`, JSON.stringify(process.env[key] ?? fileVars[key] ?? '')])
  );

  return {
    mode,
    entry: './src/main.tsx',
    output: {
      path: path.join(root, 'dist'),
      filename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      publicPath: '/',
      clean: true
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.join(root, 'tsconfig.app.json'),
              // Type-checking runs separately (`tsc -b`) so builds stay fast.
              transpileOnly: true,
              compilerOptions: { noEmit: false, allowImportingTsExtensions: false }
            }
          }
        },
        { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(defined),
      new HtmlWebpackPlugin({ template: './index.html', favicon: './public/takeda-logo.png' }),
      new MiniCssExtractPlugin({ filename: isProd ? 'assets/[name].[contenthash:8].css' : 'assets/[name].css' })
    ],
    optimization: {
      splitChunks: {
        cacheGroups: {
          // Separate cacheable chunks: third-party libraries, mock data, application code.
          vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendor', chunks: 'all', priority: 20 },
          mockData: { test: /[\\/]src[\\/]mocks[\\/]/, name: 'mock-data', chunks: 'all', priority: 10 }
        }
      }
    },
    // Current app is ~613 KiB uncompressed (~160 KiB gzipped); warn if it grows beyond that.
    performance: { hints: isProd ? 'warning' : false, maxAssetSize: 400_000, maxEntrypointSize: 700_000 },
    devServer: {
      port: 3000,
      historyApiFallback: true,
      // API mode: /api is forwarded to the local FastAPI server, so the browser sees one origin (no CORS),
      // the same as production behind CloudFront. Use PVO_API_BASE_URL=http://localhost:3000/api.
      proxy: [{ context: ['/api'], target: process.env.PVO_DEV_API_TARGET ?? fileVars.PVO_DEV_API_TARGET ?? 'http://localhost:8000' }],
      static: { directory: path.join(root, 'public') },
      hot: false,
      liveReload: true,
      client: { overlay: { errors: true, warnings: false } }
    }
  };
};
