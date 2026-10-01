import { configureAllowedScripts } from '@ministryofjustice/hmpps-npm-script-allowlist'

export default configureAllowedScripts({
  allowlist: {
    // Medusa telemetry - FORBID to disable telemetry
    'node_modules/@medusajs/telemetry@2.20.0': 'FORBID',

    // Build tools
    'node_modules/@swc/core@1.16.1': ['postinstall'],

    // Core-js sponsorship message - not needed
    'node_modules/core-js@3.50.0': 'FORBID',

    // Native modules
    'node_modules/msgpackr-extract@3.0.4': ['install'],

    // Protocol buffers
    'node_modules/protobufjs@7.6.6': ['postinstall'],

    // ESBuild is written in GoLang - this is needed to download prebuilt binaries for the specific platform
    'node_modules/esbuild@0.28.2': 'ALLOW',
    'node_modules/fsevents@2.3.3': 'ALLOW',
  },
})
