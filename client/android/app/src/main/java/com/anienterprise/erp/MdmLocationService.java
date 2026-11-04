package com.anienterprise.erp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Native Android Foreground Service for 24/7 background location and telemetry tracking.
 * - Runs continuously even when app is closed, minimized, screen is off, or phone is sleeping.
 * - Holds a partial WakeLock to ensure location updates and HTTP pings are never paused.
 * - Re-establishes on device reboot via BootReceiver.
 */
public class MdmLocationService extends Service {
    private static final String CHANNEL_ID = "mdm_tracking_channel";
    private static final int NOTIFICATION_ID = 9001;
    private static final long PING_INTERVAL_MS = 30000L; // Every 30 seconds

    private PowerManager.WakeLock wakeLock;
    private LocationManager locationManager;
    private LocationListener locationListener;
    private volatile Location lastLocation = null;

    private HandlerThread handlerThread;
    private Handler backgroundHandler;
    private Runnable pingRunnable;
    private boolean isRunning = false;
    private long lastRegisteredTime = 0;

    public static void startService(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, MdmLocationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void stopService(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, MdmLocationService.class);
            context.stopService(intent);
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForegroundNotification();
        acquireWakeLock();
        initBackgroundThread();
        setupLocationTracking();
        startTelemetryLoop();
    }

    private void initBackgroundThread() {
        if (handlerThread == null) {
            handlerThread = new HandlerThread("MdmTelemetryThread");
            handlerThread.start();
            backgroundHandler = new Handler(handlerThread.getLooper());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundNotification();
        acquireWakeLock();
        if (!isRunning) {
            startTelemetryLoop();
        }
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "MDM Fleet & Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background telemetry and GPS tracking for ANI Enterprise ERP");
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ANI Enterprise ERP")
            .setContentText("Field Tracking Active • 24/7 Location & Battery Monitoring")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anienterprise:mdm_wakelock");
                wakeLock.setReferenceCounted(false);
            }
        }
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(10 * 60 * 1000L); // 10 min timeout, refreshed periodically
        }
    }

    private void setupLocationTracking() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;
        initBackgroundThread();
        Looper bgLooper = handlerThread != null ? handlerThread.getLooper() : Looper.getMainLooper();

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null && isBetterLocation(location, lastLocation)) {
                    lastLocation = location;
                }
            }
            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override
            public void onProviderEnabled(String provider) {}
            @Override
            public void onProviderDisabled(String provider) {}
        };

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    15000L,
                    5.0f,
                    locationListener,
                    bgLooper
                );
                Location loc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (isBetterLocation(loc, lastLocation)) lastLocation = loc;
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    25000L,
                    15.0f,
                    locationListener,
                    bgLooper
                );
                Location loc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (isBetterLocation(loc, lastLocation)) lastLocation = loc;
            }
        } catch (SecurityException ignored) {
        } catch (Exception ignored) {}
    }

    private static final int TWO_MINUTES = 1000 * 60 * 2;

    /** Determines whether one Location reading is better than the current Location fix */
    private boolean isBetterLocation(Location location, Location currentBestLocation) {
        if (location == null) {
            return false;
        }
        if (currentBestLocation == null) {
            return true;
        }

        long timeDelta = location.getTime() - currentBestLocation.getTime();
        boolean isSignificantlyNewer = timeDelta > TWO_MINUTES;
        boolean isSignificantlyOlder = timeDelta < -TWO_MINUTES;
        boolean isNewer = timeDelta > 0;

        if (isSignificantlyNewer) {
            return true;
        } else if (isSignificantlyOlder) {
            return false;
        }

        int accuracyDelta = (int) (location.getAccuracy() - currentBestLocation.getAccuracy());
        boolean isLessAccurate = accuracyDelta > 0;
        boolean isMoreAccurate = accuracyDelta < 0;
        boolean isSignificantlyLessAccurate = accuracyDelta > 100;

        boolean isFromSameProvider = isSameProvider(location.getProvider(), currentBestLocation.getProvider());

        if (isMoreAccurate) {
            return true;
        } else if (isNewer && !isLessAccurate) {
            return true;
        } else if (isNewer && !isSignificantlyLessAccurate && isFromSameProvider) {
            return true;
        }
        return false;
    }

    private boolean isSameProvider(String provider1, String provider2) {
        if (provider1 == null) {
            return provider2 == null;
        }
        return provider1.equals(provider2);
    }

    private void startTelemetryLoop() {
        isRunning = true;
        initBackgroundThread();

        pingRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    acquireWakeLock();
                    sendTelemetryPing();
                } catch (Exception e) {
                    e.printStackTrace();
                }
                if (isRunning && backgroundHandler != null) {
                    backgroundHandler.postDelayed(this, PING_INTERVAL_MS);
                }
            }
        };

        backgroundHandler.post(pingRunnable);
    }

    private void sendTelemetryPing() {
        SharedPreferences prefs = getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
        if (!prefs.getBoolean("is_tracking_enabled", true)) return;

        String serverUrl = prefs.getString("server_url", "http://192.168.0.27:5000");
        if (serverUrl == null || serverUrl.trim().isEmpty()) {
            serverUrl = "http://192.168.0.27:5000";
        }
        serverUrl = serverUrl.replaceAll("/+$", "");

        String deviceId = prefs.getString("device_id", "");
        if (deviceId.isEmpty()) {
            String androidId = "";
            try {
                androidId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            } catch (Exception ignored) {}
            if (androidId != null && !androidId.trim().isEmpty()) {
                deviceId = "DEV-" + androidId.toUpperCase();
            } else {
                deviceId = "DEV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase() + "-" + Long.toString(System.currentTimeMillis(), 36).toUpperCase();
            }
            prefs.edit().putString("device_id", deviceId).apply();
        }

        String employeeId = prefs.getString("employee_id", "");
        String employeeName = prefs.getString("employee_name", "");
        String employeeEmpId = prefs.getString("employee_emp_id", "");

        // Battery Status
        int batteryLevel = -1;
        boolean isCharging = false;
        try {
            Intent batteryIntent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (batteryIntent != null) {
                int rawLevel = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                int status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                isCharging = (status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);
                if (scale > 0 && rawLevel >= 0) {
                    batteryLevel = Math.round((rawLevel / (float) scale) * 100);
                }
            }
        } catch (Exception ignored) {}

        // Network Status
        String networkType = "cellular";
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
                if (caps != null) {
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        networkType = "wifi";
                    } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                        networkType = "cellular";
                    }
                }
            }
        } catch (Exception ignored) {}

        // Active on-demand GPS reading on Android 11+ (API 30+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && locationManager != null) {
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    java.util.concurrent.Executor bgExecutor = backgroundHandler != null ? backgroundHandler::post : getMainExecutor();
                    locationManager.getCurrentLocation(
                        LocationManager.GPS_PROVIDER,
                        null,
                        bgExecutor,
                        new java.util.function.Consumer<Location>() {
                            @Override
                            public void accept(Location location) {
                                if (location != null && isBetterLocation(location, lastLocation)) {
                                    lastLocation = location;
                                }
                            }
                        }
                    );
                }
            } catch (SecurityException ignored) {
            } catch (Exception ignored) {}
        }

        // Best location evaluation
        Location loc = lastLocation;
        if (locationManager != null) {
            try {
                Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (isBetterLocation(lastGps, loc)) {
                    loc = lastGps;
                    lastLocation = lastGps;
                }
                Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (isBetterLocation(lastNet, loc)) {
                    loc = lastNet;
                    lastLocation = lastNet;
                }
            } catch (SecurityException ignored) {}
        }

        long now = System.currentTimeMillis();

        // 1. Ensure registered once every 30 minutes
        if (now - lastRegisteredTime > 30 * 60 * 1000L) {
            try {
                JSONObject reg = new JSONObject();
                reg.put("deviceId", deviceId);
                reg.put("deviceModel", Build.MANUFACTURER + " " + Build.MODEL);
                reg.put("manufacturer", Build.MANUFACTURER);
                reg.put("osVersion", "android " + Build.VERSION.RELEASE);
                reg.put("platform", "android");
                reg.put("appVersion", "1.0.0");
                if (batteryLevel >= 0) reg.put("batteryLevel", batteryLevel);
                reg.put("isCharging", isCharging);
                reg.put("networkType", networkType);
                if (!employeeId.isEmpty()) reg.put("employeeId", employeeId);
                if (!employeeName.isEmpty()) reg.put("employeeName", employeeName);
                if (!employeeEmpId.isEmpty()) reg.put("employeeEmpId", employeeEmpId);

                httpPost(serverUrl + "/api/mdm/register", reg.toString());
                lastRegisteredTime = now;
            } catch (Exception ignored) {}
        }

        // 2. Transmit periodic telemetry ping
        try {
            JSONObject ping = new JSONObject();
            ping.put("deviceId", deviceId);
            if (batteryLevel >= 0) ping.put("batteryLevel", batteryLevel);
            ping.put("isCharging", isCharging);
            ping.put("networkType", networkType);
            ping.put("isGpsEnabled", loc != null);
            ping.put("trackingPermission", "granted");

            if (loc != null) {
                JSONObject locObj = new JSONObject();
                locObj.put("lat", loc.getLatitude());
                locObj.put("lng", loc.getLongitude());
                locObj.put("accuracy", loc.getAccuracy());
                locObj.put("speed", Math.round(loc.getSpeed() * 3.6f));
                locObj.put("heading", loc.getBearing());
                locObj.put("altitude", loc.getAltitude());
                ping.put("location", locObj);
            }

            httpPost(serverUrl + "/api/mdm/ping", ping.toString());
        } catch (Exception ignored) {}
    }

    private void httpPost(String targetUrl, String json) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(targetUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);

            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes, 0, bytes.length);
                os.flush();
            }

            conn.getResponseCode();
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (backgroundHandler != null && pingRunnable != null) {
            backgroundHandler.removeCallbacks(pingRunnable);
        }
        if (handlerThread != null) {
            handlerThread.quitSafely();
            handlerThread = null;
        }
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (SecurityException ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}

