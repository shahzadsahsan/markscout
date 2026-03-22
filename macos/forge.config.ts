import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'MarkReader',
    executableName: 'MarkReader',
    appBundleId: 'com.shahzad.markreader',
    icon: './resources/icon',
    asar: true,
    // Include the parent Next.js app in the package
    extraResource: [
      '../.next',
      '../public',
      '../next.config.ts',
      '../package.json',
      '../node_modules',
    ],
    // No signing for personal use
    osxSign: undefined,
    osxNotarize: undefined,
    // Ignore dev-only files
    ignore: [
      /^\/\.git/,
      /^\/\.next\/cache/,
      /^\/src/,  // Source not needed in production (built into .next)
    ],
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: 'MarkReader',
    }, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
