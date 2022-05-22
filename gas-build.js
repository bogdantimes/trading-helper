const { GasPlugin } = require('esbuild-gas-plugin')

require('esbuild').build({
  entryPoints: ['src/gas/index.ts'],
  bundle: true,
  outfile: 'apps-script/bundle.js',
  plugins: [GasPlugin],
}).catch((e) => process.exit(1))
