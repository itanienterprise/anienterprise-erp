package com.anienterprise.erp;

import android.app.AlarmManager;
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
import android.os.SystemClock;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Native Android Foreground Service for 24/7 background location and telemetry tracking.
 * - Runs continuously even when app is closed, minimized, screen is off, or phone is sleeping.
 * - Holds a partial WakeLock to ensure location updates and HTTP pings are never paused.
 * - Re-establishes on device reboot via BootReceiver and when cleared from recents via onTaskRemoved.
 * - Uses AlarmManager exact wake alarms to guarantee continuous heartbeats in deep Doze sleep.
 */
public class MdmLocationService extends Service {
    private static final String CHANNEL_ID = "mdm_silent_service";
    private static final int NOTIFICATION_ID = 9001;
    private static final long PING_INTERVAL_MS = 30000L; // Every 30 seconds
    private static final String ACTION_HEARTBEAT = "com.anienterprise.erp.MDM_HEARTBEAT";

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
        scheduleNextAlarmPing();
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

        if (intent != null && ACTION_HEARTBEAT.equals(intent.getAction())) {
            // Heartbeat woke the CPU: trigger telemetry ping immediately in background
            if (backgroundHandler != null) {
                backgroundHandler.post(this::sendTelemetryPing);
            } else {
                new Thread(this::sendTelemetryPing).start();
            }
            scheduleNextAlarmPing();
            return START_STICKY;
        }

        if (!isRunning) {
            startTelemetryLoop();
        }
        scheduleNextAlarmPing();
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // User swiped the app away from Recent Apps list: immediately schedule service revival
        try {
            Intent restartIntent = new Intent(getApplicationContext(), MdmLocationService.class);
            restartIntent.setPackage(getPackageName());
            PendingIntent pendingIntent = PendingIntent.getService(
                getApplicationContext(),
                101,
                restartIntent,
                PendingIntent.FLAG_ONE_SHOT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                long triggerAt = SystemClock.elapsedRealtime() + 1000L;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent);
                }
            }
        } catch (Exception ignored) {}
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                // Delete old channel that showed visible notifications
                try {
                    nm.deleteNotificationChannel("mdm_tracking_channel");
                } catch (Exception ignored) {}

                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Silent MDM Service",
                    NotificationManager.IMPORTANCE_MIN
                );
                channel.setDescription("Silent background MDM telemetry sync");
                channel.setShowBadge(false);
                channel.setSound(null, null);
                channel.enableVibration(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
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
            .setContentText("Background service active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setShowWhen(false)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification(String text) {
        // Silent service: do not re-post or refresh notifications to prevent popups or lockscreen alerts
    }

    private boolean isWithinShift(SharedPreferences prefs) {
        String mode = prefs.getString("tracking_mode", "shift");
        if ("always".equalsIgnoreCase(mode)) {
            return true;
        }

        // If server evaluated shift recently (< 15 minutes), prefer server judgment
        long evaluatedAt = prefs.getLong("shift_evaluated_at", 0);
        long nowMs = System.currentTimeMillis();
        if (prefs.contains("server_is_within_shift") && (nowMs - evaluatedAt < 15 * 60 * 1000L)) {
            return prefs.getBoolean("server_is_within_shift", true);
        }

        // Check if marked holiday
        if (prefs.getBoolean("is_holiday", false)) {
            return false;
        }

        // Check work days if defined
        String workDays = prefs.getString("work_days", "");
        if (workDays != null && !workDays.trim().isEmpty()) {
            String[] days = new String[]{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
            java.util.Calendar cal = java.util.Calendar.getInstance();
            String today = days[cal.get(java.util.Calendar.DAY_OF_WEEK) - 1];
            if (!workDays.contains(today)) {
                return false;
            }
        }

        String startTime = prefs.getString("shift_start", "09:00");
        String endTime = prefs.getString("shift_end", "18:00");
        int graceMinutes = prefs.getInt("grace_minutes", 15);

        try {
            String[] sParts = startTime.split(":");
            String[] eParts = endTime.split(":");
            int startMin = Integer.parseInt(sParts[0].trim()) * 60 + (sParts.length > 1 ? Integer.parseInt(sParts[1].trim()) : 0);
            int endMin = Integer.parseInt(eParts[0].trim()) * 60 + (eParts.length > 1 ? Integer.parseInt(eParts[1].trim()) : 0);

            java.util.Calendar cal = java.util.Calendar.getInstance();
            int currentMin = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE);

            int s = (startMin - graceMinutes + 1440) % 1440;
            int e = (endMin + graceMinutes) % 1440;

            if (startMin <= endMin) {
                if (s <= e) {
                    return currentMin >= s && currentMin <= e;
                } else {
                    return currentMin >= s || currentMin <= e;
                }
            } else {
                return currentMin >= s || currentMin <= e;
            }
        } catch (Exception ignored) {
            return true;
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
            // High-precision GPS with 0.0f minDistance to ensure stationary updates aren't suppressed
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    10000L,
                    0.0f,
                    locationListener,
                    bgLooper
                );
                Location loc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (isBetterLocation(loc, lastLocation)) lastLocation = loc;
            }

            // Network / Cell / WiFi provider fallback
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    20000L,
                    0.0f,
                    locationListener,
                    bgLooper
                );
                Location loc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (isBetterLocation(loc, lastLocation)) lastLocation = loc;
            }

            // Passive provider to capture fixes generated by other apps (e.g. Google Maps)
            if (locationManager.getAllProviders().contains(LocationManager.PASSIVE_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.PASSIVE_PROVIDER,
                    10000L,
                    0.0f,
                    locationListener,
                    bgLooper
                );
            }
        } catch (SecurityException ignored) {
        } catch (Exception ignored) {}
    }

    /**
     * Determines whether a new Location fix is better than the existing best reading.
     * Crucial: Prevents coarse Network/Cell tower fixes (> 70m) from overwriting pinpoint GPS fixes (< 35m).
     */
    private boolean isBetterLocation(Location newLoc, Location currentBest) {
        if (newLoc == null) return false;
        if (currentBest == null) return true;

        long timeDelta = newLoc.getTime() - currentBest.getTime();
        boolean isNewer = timeDelta > 0;
        boolean isSignificantlyOlder = timeDelta < -120000L; // 2 minutes older
        if (isSignificantlyOlder) return false;

        float newAcc = newLoc.hasAccuracy() ? newLoc.getAccuracy() : 9999.0f;
        float bestAcc = currentBest.hasAccuracy() ? currentBest.getAccuracy() : 9999.0f;

        // Protection: If current best fix is pinpoint accurate (<= 35m), never allow a coarse reading (> 70m)
        // to replace it unless current fix is older than 10 minutes.
        if (bestAcc <= 35.0f && newAcc > 70.0f && timeDelta < 10 * 60 * 1000L) {
            return false;
        }

        // Always accept if new location has significantly better accuracy
        if (newAcc < bestAcc) {
            return true;
        }

        // If newer with high accuracy (<= 40m), accept
        if (isNewer && newAcc <= 40.0f) {
            return true;
        }

        // If significantly newer (> 5 minutes) and acceptable accuracy (<= 150m)
        if (timeDelta > 5 * 60 * 1000L && newAcc <= 150.0f) {
            return true;
        }

        return false;
    }

    private void scheduleNextAlarmPing() {
        try {
            Intent pingIntent = new Intent(this, MdmLocationService.class);
            pingIntent.setAction(ACTION_HEARTBEAT);
            PendingIntent pi = PendingIntent.getService(
                this,
                102,
                pingIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                long nextTrigger = SystemClock.elapsedRealtime() + PING_INTERVAL_MS;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTrigger, pi);
                } else {
                    am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTrigger, pi);
                }
            }
        } catch (Exception ignored) {}
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
                scheduleNextAlarmPing();
            }
        };

        backgroundHandler.post(pingRunnable);
    }

    private void sendTelemetryPing() {
        SharedPreferences prefs = getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
        if (!prefs.getBoolean("is_tracking_enabled", true)) return;

        String defaultUrl = "http://189.31.39.166:3000";
        try {
            int resId = getResources().getIdentifier("server_url", "string", getPackageName());
            if (resId != 0) {
                defaultUrl = getString(resId);
            }
        } catch (Exception ignored) {}
        String serverUrl = prefs.getString("server_url", defaultUrl);
        if (serverUrl == null || serverUrl.trim().isEmpty() || serverUrl.contains("localhost") || serverUrl.contains("192.168.0.27")) {
            serverUrl = defaultUrl;
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

        // Check GPS hardware state
        boolean isGpsHardwareEnabled = false;
        if (locationManager != null) {
            try {
                isGpsHardwareEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            } catch (Exception ignored) {}
        }

        // Shift Timing Verification & Status Update
        boolean withinShift = isWithinShift(prefs);
        String shiftStart = prefs.getString("shift_start", "09:00");
        String shiftEnd = prefs.getString("shift_end", "18:00");
        String trackingMode = prefs.getString("tracking_mode", "shift");

        if ("always".equalsIgnoreCase(trackingMode)) {
            updateNotification("Field Tracking Active • 24/7 Monitoring");
        } else if (withinShift) {
            updateNotification("Field Tracking Active • On-Shift (" + shiftStart + " - " + shiftEnd + ")");
        } else {
            updateNotification("Field Tracking Paused • Off-Shift (" + shiftStart + " - " + shiftEnd + ")");
        }

        // Query fresh GPS reading during shift or 24/7
        Location loc = null;
        if (withinShift) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && locationManager != null && isGpsHardwareEnabled) {
                try {
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
                } catch (SecurityException ignored) {
                } catch (Exception ignored) {}
            }

            // Best location evaluation: prefer GPS
            loc = lastLocation;
            if (locationManager != null) {
                try {
                    Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (isBetterLocation(lastGps, loc)) {
                        loc = lastGps;
                        lastLocation = lastGps;
                    }
                    // Only fallback to network if no GPS reading or GPS reading is very coarse (> 100m)
                    if (loc == null || (loc.hasAccuracy() && loc.getAccuracy() > 100.0f)) {
                        Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                        if (isBetterLocation(lastNet, loc)) {
                            loc = lastNet;
                            lastLocation = lastNet;
                        }
                    }
                } catch (SecurityException ignored) {}
            }
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

                String regRes = httpPost(serverUrl + "/api/mdm/register", reg.toString());
                if (regRes != null && !regRes.trim().isEmpty()) {
                    try {
                        JSONObject resObj = new JSONObject(regRes);
                        if (resObj.has("shift")) {
                            JSONObject sObj = resObj.getJSONObject("shift");
                            SharedPreferences.Editor ed = prefs.edit();
                            if (sObj.has("trackingMode")) ed.putString("tracking_mode", sObj.getString("trackingMode"));
                            if (sObj.has("startTime") && !sObj.isNull("startTime")) ed.putString("shift_start", sObj.getString("startTime"));
                            if (sObj.has("endTime") && !sObj.isNull("endTime")) ed.putString("shift_end", sObj.getString("endTime"));
                            if (sObj.has("graceMinutes")) ed.putInt("grace_minutes", sObj.getInt("graceMinutes"));
                            if (sObj.has("isHoliday")) ed.putBoolean("is_holiday", sObj.getBoolean("isHoliday"));
                            if (sObj.has("isWithinShift")) ed.putBoolean("server_is_within_shift", sObj.getBoolean("isWithinShift"));
                            ed.putLong("shift_evaluated_at", System.currentTimeMillis());
                            ed.apply();
                        }
                    } catch (Exception ignored) {}
                }
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
            // Reflect true GPS hardware enablement on device
            ping.put("isGpsEnabled", isGpsHardwareEnabled);
            ping.put("trackingPermission", "granted");

            if (withinShift && loc != null) {
                JSONObject locObj = new JSONObject();
                locObj.put("lat", loc.getLatitude());
                locObj.put("lng", loc.getLongitude());
                locObj.put("accuracy", loc.getAccuracy());
                locObj.put("speed", Math.round(loc.getSpeed() * 3.6f));
                locObj.put("heading", loc.getBearing());
                locObj.put("altitude", loc.getAltitude());
                ping.put("location", locObj);
            }

            String pingRes = httpPost(serverUrl + "/api/mdm/ping", ping.toString());
            if (pingRes != null && !pingRes.trim().isEmpty()) {
                try {
                    JSONObject resObj = new JSONObject(pingRes);
                    if (resObj.has("shift")) {
                        JSONObject sObj = resObj.getJSONObject("shift");
                        SharedPreferences.Editor ed = prefs.edit();
                        if (sObj.has("trackingMode")) ed.putString("tracking_mode", sObj.getString("trackingMode"));
                        if (sObj.has("startTime") && !sObj.isNull("startTime")) ed.putString("shift_start", sObj.getString("startTime"));
                        if (sObj.has("endTime") && !sObj.isNull("endTime")) ed.putString("shift_end", sObj.getString("endTime"));
                        if (sObj.has("graceMinutes")) ed.putInt("grace_minutes", sObj.getInt("graceMinutes"));
                        if (sObj.has("isHoliday")) ed.putBoolean("is_holiday", sObj.getBoolean("isHoliday"));
                        if (sObj.has("isWithinShift")) ed.putBoolean("server_is_within_shift", sObj.getBoolean("isWithinShift"));
                        ed.putLong("shift_evaluated_at", System.currentTimeMillis());
                        ed.apply();
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    private String httpPost(String targetUrl, String json) {
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

            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return sb.toString();
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
        return null;
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
