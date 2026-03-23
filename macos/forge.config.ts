import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'MarkScout',
    executableName: 'MarkScout',
    appBundleId: 'com.markscout.app',
    icon: './resources/icon',
    asar: true,
    // Use the lean staging directory (created by scripts/prepare-resources.sh)
    extraResource: [
      '.staging/.next',
      '.staging/public',
      '.staging/next.config.ts',
      '.staging/package.json',
      '.staging/node_modules',
    ],
    // No signing for personal use
    osxSign: undefined,
    osxNotarize: undefined,
    // Ignore dev-only files
    ignore: [
      /^\/\.git/,
      /^\/src/,
      /^\/\.staging/,    // Don't double-bundle staging dir into asar
      /^\/scripts/,
    ],
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: 'MarkScout',
    }, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
