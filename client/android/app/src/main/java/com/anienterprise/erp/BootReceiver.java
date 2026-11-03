package com.anienterprise.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Automatically starts the MDM location service on device boot.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE);
            boolean isTracking = prefs.getBoolean("is_tracking_enabled", true);
            if (isTracking) {
                MdmLocationService.startService(context);
            }
        }
    }
}

