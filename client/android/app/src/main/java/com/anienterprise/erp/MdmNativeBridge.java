package com.anienterprise.erp;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

/**
 * JavaScript interface exposed to the WebView as window.AndroidBridge.
 * Allows the React application to configure the 24/7 background MDM service.
 */
public class MdmNativeBridge {
    private final Context context;

    public MdmNativeBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void updateConfig(String serverUrl, String deviceId, String employeeId, String employeeName, String employeeEmpId) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (serverUrl != null && !serverUrl.trim().isEmpty()) {
            editor.putString("server_url", serverUrl.trim());
        }
        if (deviceId != null && !deviceId.trim().isEmpty()) {
            editor.putString("device_id", deviceId.trim());
        }
        if (employeeId != null && !employeeId.trim().isEmpty()) {
            editor.putString("employee_id", employeeId.trim());
        }
        if (employeeName != null && !employeeName.trim().isEmpty()) {
            editor.putString("employee_name", employeeName.trim());
        }
        if (employeeEmpId != null && !employeeEmpId.trim().isEmpty()) {
            editor.putString("employee_emp_id", employeeEmpId.trim());
        }
        editor.putBoolean("is_tracking_enabled", true);
        editor.apply();

        // Launch the native background foreground service
        MdmLocationService.startService(context);
    }

    @JavascriptInterface
    public void updateShiftConfig(String trackingMode, String startTime, String endTime, int graceMinutes) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (trackingMode != null && !trackingMode.trim().isEmpty()) {
            editor.putString("tracking_mode", trackingMode.trim());
        }
        if (startTime != null && !startTime.trim().isEmpty()) {
            editor.putString("shift_start", startTime.trim());
        }
        if (endTime != null && !endTime.trim().isEmpty()) {
            editor.putString("shift_end", endTime.trim());
        }
        if (graceMinutes >= 0) {
            editor.putInt("grace_minutes", graceMinutes);
        }
        editor.apply();

        MdmLocationService.startService(context);
    }

    @JavascriptInterface
    public String getDeviceId() {
        if (context == null) return "";
        SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
        String deviceId = prefs.getString("device_id", "");
        if (deviceId.isEmpty()) {
            String androidId = "";
            try {
                androidId = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            } catch (Exception ignored) {}
            if (androidId != null && !androidId.trim().isEmpty()) {
                deviceId = "DEV-" + androidId.toUpperCase();
                prefs.edit().putString("device_id", deviceId).apply();
            }
        }
        return deviceId;
    }

    @JavascriptInterface
    public void startService() {
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("is_tracking_enabled", true).apply();
            MdmLocationService.startService(context);
        }
    }

    @JavascriptInterface
    public void stopService() {
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("is_tracking_enabled", false).apply();
            MdmLocationService.stopService(context);
        }
    }
}

