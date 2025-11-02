import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.dashapp',
  appName: 'DashApp',
  webDir: 'dist',
  server: {
    url: 'http://192.168.189.155:5173', // ✅ URL ของ Dash/React ที่รันอยู่
    cleartext: true, // อนุญาต HTTP (ไม่ต้องเป็น HTTPS)
  },
};

export default config;
