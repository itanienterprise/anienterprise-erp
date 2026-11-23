package com.anienterprise.erp;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

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

    /**
     * Native file saving and viewing for Android APK.
     * Receives base64 encoded file data from the WebView, saves it to the public Downloads folder,
     * displays a confirmation Toast, and immediately prompts the system viewer to open or share the file.
     */
    @JavascriptInterface
    public boolean saveBase64File(String base64Data, String fileName, String mimeType) {
        return saveAndOpenFile(base64Data, fileName, mimeType, true);
    }

    @JavascriptInterface
    public boolean saveAndOpenFile(final String rawBase64, final String initialFileName, final String initialMimeType, final boolean openImmediately) {
        if (context == null || rawBase64 == null || rawBase64.trim().isEmpty()) {
            return false;
        }

        try {
            // 1. Resolve mimeType and strip any data URL prefix
            String cleanBase64 = rawBase64.trim();
            String resolvedMime = initialMimeType;
            if (cleanBase64.startsWith("data:") && cleanBase64.contains(";base64,")) {
                int colonIdx = cleanBase64.indexOf(":");
                int semicolonIdx = cleanBase64.indexOf(";");
                if (colonIdx >= 0 && semicolonIdx > colonIdx && (resolvedMime == null || resolvedMime.trim().isEmpty())) {
                    resolvedMime = cleanBase64.substring(colonIdx + 1, semicolonIdx);
                }
                cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
            } else if (cleanBase64.contains(",")) {
                cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
            }

            cleanBase64 = cleanBase64.replaceAll("\\s+", "");
            final byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            if (fileBytes == null || fileBytes.length == 0) {
                Log.e("MdmNativeBridge", "Decoded file bytes are empty");
                return false;
            }

            String name = (initialFileName != null && !initialFileName.trim().isEmpty()) ? initialFileName.trim() : "Document";
            // Sanitize illegal filename characters
            name = name.replaceAll("[\\\\/:*?\"<>|]", "_");

            if (resolvedMime == null || resolvedMime.trim().isEmpty()) {
                if (name.toLowerCase().endsWith(".pdf")) {
                    resolvedMime = "application/pdf";
                } else if (name.toLowerCase().endsWith(".xlsx")) {
                    resolvedMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                } else if (name.toLowerCase().endsWith(".xls")) {
                    resolvedMime = "application/vnd.ms-excel";
                } else if (name.toLowerCase().endsWith(".json")) {
                    resolvedMime = "application/json";
                } else {
                    resolvedMime = "application/octet-stream";
                }
            }

            if (!name.contains(".")) {
                if ("application/pdf".equalsIgnoreCase(resolvedMime)) {
                    name += ".pdf";
                } else if ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equalsIgnoreCase(resolvedMime)) {
                    name += ".xlsx";
                } else if ("application/json".equalsIgnoreCase(resolvedMime)) {
                    name += ".json";
                }
            }

            final String finalFileName = name;
            final String finalMimeType = resolvedMime;

            // 2. Save directly to Public Downloads folder (so user finds it in their Downloads app)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalFileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, finalMimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                    Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    Uri downloadUri = context.getContentResolver().insert(collection, values);
                    if (downloadUri != null) {
                        OutputStream os = context.getContentResolver().openOutputStream(downloadUri);
                        if (os != null) {
                            os.write(fileBytes);
                            os.flush();
                            os.close();
                        }
                        values.clear();
                        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        context.getContentResolver().update(downloadUri, values, null, null);
                    }
                } catch (Exception e) {
                    Log.e("MdmNativeBridge", "MediaStore download error", e);
                }
            } else {
                try {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();
                    File target = new File(downloadsDir, finalFileName);
                    FileOutputStream fos = new FileOutputStream(target);
                    fos.write(fileBytes);
                    fos.flush();
                    fos.close();
                    android.media.MediaScannerConnection.scanFile(
                        context,
                        new String[]{target.getAbsolutePath()},
                        new String[]{finalMimeType},
                        null
                    );
                } catch (Exception e) {
                    Log.e("MdmNativeBridge", "Public downloads error", e);
                }
            }

            // 3. Save copy in app cache directory for instant opening via FileProvider
            File cacheDir = new File(context.getCacheDir(), "shared_downloads");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            final File cacheFile = new File(cacheDir, finalFileName);
            try {
                FileOutputStream fos = new FileOutputStream(cacheFile);
                fos.write(fileBytes);
                fos.flush();
                fos.close();
            } catch (Exception e) {
                Log.e("MdmNativeBridge", "Cache write error", e);
            }

            // 4. UI Thread: Show Toast and launch native Open / Share Intent
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        Toast.makeText(context, "Saved to Downloads: " + finalFileName, Toast.LENGTH_LONG).show();

                        if (openImmediately && cacheFile.exists()) {
                            try {
                                Uri contentUri = FileProvider.getUriForFile(
                                    context,
                                    context.getPackageName() + ".fileprovider",
                                    cacheFile
                                );

                                Intent intent = new Intent(Intent.ACTION_VIEW);
                                intent.setDataAndType(contentUri, finalMimeType);
                                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                                Intent chooser = Intent.createChooser(intent, "Open " + finalFileName);
                                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                context.startActivity(chooser);
                            } catch (Exception openEx) {
                                Log.w("MdmNativeBridge", "No app available to open file: " + openEx.getMessage());
                            }
                        }
                    } catch (Exception ignored) {}
                }
            });

            return true;
        } catch (Exception e) {
            Log.e("MdmNativeBridge", "saveAndOpenFile exception", e);
            return false;
        }
    }
}

