import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneroflow.app',
  appName: 'MoneroFlow',
  webDir: 'dist',
  // Android webview handles the SPA; keep device-origin security tight.
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false, // no plaintext http from the webview
  },
  android: {
    backgroundColor: '#0a0a0a', // monero dark charcoal
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0a0a0a',
  },
  plugins: {
    CapacitorHttp: { enabled: true }, // proxy native fetch through HTTP plugin
    CapacitorCookies: { enabled: true },
    Camera: { presentationStyle: 'fullscreen', saveToGallery: false },
    Biometric: {
      // capgo native biometric — fingerprint / Face ID unlock
    },
    SplashScreen: {
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
