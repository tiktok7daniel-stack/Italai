import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.dillo.italiano",
  appName: "Dillo",
  webDir: "dist",
  backgroundColor: "#07070a",
  android: {
    backgroundColor: "#07070a",
  },
  plugins: {
    SystemBars: {
      style: "DARK",
      insetsHandling: "css",
    },
  },
};

export default config;
