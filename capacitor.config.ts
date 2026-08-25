import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eliteacs.estimating',
  appName: 'Elite Estimating',
  webDir: 'dist-client',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
