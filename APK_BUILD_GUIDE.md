# ANI Enterprise ERP - Android APK Generation & MDM Setup Guide

This guide walks you through generating the Android APK for the ANI Enterprise ERP with Mobile Device Management (MDM), background GPS tracking, and battery telemetry.

---

## Architecture Summary
1. **Frontend**: React 19 + Vite (`client/`) wrapped using **Capacitor**.
2. **MDM Engine**: 
   - Backend APIs: `/api/mdm/register`, `/api/mdm/ping`, `/api/mdm/devices`, `/api/mdm/live-locations`, `/api/mdm/history`.
   - Real-time broadcasts: Socket.IO events (`mdm_telemetry`, `mdm_device_registered`).
   - Native Device Sensors: Location (GPS Coordinates, Speed, Accuracy) and Battery (Percentage, AC/USB Charging status).

---

## Quick Steps to Build the Android APK

### Step 1: Install Capacitor Native Packages
Run the following in the `client` directory:
```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/device @capacitor/network
```

### Step 2: Initialize & Build the Web Assets
Build the production Vite distribution:
```bash
npm run build
```

### Step 3: Add the Android Native Platform
Initialize the Android project (run once):
```bash
npx cap add android
```
*(If already added, simply sync the latest web build):*
```bash
npx cap sync android
```

### Step 4: Configure Android Permissions
Open `client/android/app/src/main/AndroidManifest.xml` and ensure the following permissions are present inside the `<manifest>` tag:

```xml
<!-- Background Geolocation & Network Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Foreground Service for unkillable tracking -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Battery Telemetry -->
<uses-permission android:name="android.permission.BATTERY_STATS" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

### Step 5: Build Debug or Release APK

#### Option A: Command Line (Fastest)
```bash
cd client/android
./gradlew assembleDebug
```
The output APK will be generated at:
`client/android/app/build/outputs/apk/debug/app-debug.apk`

#### Option B: Android Studio GUI
Open the android folder in Android Studio:
```bash
npx cap open android
```
In Android Studio:
1. Click **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Locate the APK file and install it directly on employee Android devices (`adb install app-debug.apk` or via WhatsApp/Google Drive).

---

## Testing in Browser Before APK Build
You can test the entire pipeline right now:
1. Start ERP server: `cd server && npm start`
2. Start client: `cd client && npm run dev`
3. Navigate to **HRMS** > **MDM & Tracking** in the sidebar.
4. Go to the **APK Bridge & Test** tab.
5. Click **"Acquire My Current GPS"** and **"Emit Live Telemetry Ping"**.
6. Switch to the **Live Map** tab to see your marker, speed, and real-time battery status!

