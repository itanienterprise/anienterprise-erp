package com.anienterprise.erp;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import android.webkit.CookieManager;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int BACKGROUND_LOCATION_REQUEST_CODE = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        enableCookies();
        setupNativeBridge();
        requestAllRequiredPermissions();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureSystemBars();
        enableCookies();
        setupNativeBridge();
        checkAndStartMdmService();
    }

    private void configureSystemBars() {
        try {
            // 1. Force the system navigation bar to pure white
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getWindow().setNavigationBarColor(android.graphics.Color.WHITE);
            }

            // 2. Disable Android 10+ (API 29+) dark scrim/contrast enforcement over navigation bar
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getWindow().setNavigationBarContrastEnforced(false);
            }

            // 3. Make navigation bar icons & gesture pill dark so they are visible on the white bar
            androidx.core.view.WindowInsetsControllerCompat insetsController =
                androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightNavigationBars(true);
                insetsController.setAppearanceLightStatusBars(true);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                int flags = getWindow().getDecorView().getSystemUiVisibility();
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                getWindow().getDecorView().setSystemUiVisibility(flags);
            }

            // 4. Ensure WebView background is solid white
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(android.graphics.Color.WHITE);
            }
        } catch (Exception ignored) {}
    }

    private void enableCookies() {
        try {
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            if (getBridge() != null && getBridge().getWebView() != null) {
                cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
            }
        } catch (Exception ignored) {}
    }

    private void setupNativeBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().addJavascriptInterface(new MdmNativeBridge(this), "AndroidBridge");
            }
        } catch (Exception ignored) {}
    }

    private void checkAndStartMdmService() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            MdmLocationService.startService(this);
        }
    }

    private void requestAllRequiredPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        // 1. Fine and Coarse GPS Location
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        // 2. Notifications (Required for foreground service on Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsNeeded.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        } else {
            // Foreground location is already granted, prompt for background location and launch service
            requestBackgroundLocationPermission();
            checkAndStartMdmService();
        }

        // 3. Prompt for unconstrained battery optimization (so device sleep won't kill telemetry)
        requestBatteryOptimization();
    }

    private void requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                    BACKGROUND_LOCATION_REQUEST_CODE
                );
            }
        }
    }

    private void requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } catch (Exception ignored) {
                // Ignore vendor specific restriction if activity is not supported
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean locationGranted = false;
            for (int i = 0; i < permissions.length; i++) {
                if (Manifest.permission.ACCESS_FINE_LOCATION.equals(permissions[i]) && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    locationGranted = true;
                    break;
                }
            }
            if (locationGranted) {
                requestBackgroundLocationPermission();
                checkAndStartMdmService();
            }
        }
    }
}
