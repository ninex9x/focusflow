package com.focusflow.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

final class FocusFlowNotifications {
    private static final String TIMER_CHANNEL_ID = "focusflow_timer_v1";
    private static final String ALERTS_CHANNEL_ID = "focusflow_alerts_v1";
    private static final String ALERT_GROUP_KEY = "focusflow_alerts";
    private static final String PREFERENCES = "focusflow_notifications";
    private static final String ACTIVE_ALERT_IDS = "active_alert_ids";
    private static final String SEEN_ALERT_IDS = "seen_alert_ids";
    private static final int TIMER_NOTIFICATION_ID = 1001;
    private static final int ALERT_NOTIFICATION_ID = 2001;

    private final Context context;
    private final NotificationManager manager;
    private final SharedPreferences preferences;

    FocusFlowNotifications(Context context) {
        this.context = context.getApplicationContext();
        this.manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        this.preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        createChannels();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel timer = new NotificationChannel(
                TIMER_CHANNEL_ID,
                context.getString(R.string.notification_channel_timer),
                NotificationManager.IMPORTANCE_LOW
        );
        timer.setDescription(context.getString(R.string.notification_channel_timer_description));
        timer.setSound(null, null);
        timer.enableVibration(false);
        timer.setShowBadge(false);

        NotificationChannel alerts = new NotificationChannel(
                ALERTS_CHANNEL_ID,
                context.getString(R.string.notification_channel_alerts),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        alerts.setDescription(context.getString(R.string.notification_channel_alerts_description));

        manager.createNotificationChannel(timer);
        manager.createNotificationChannel(alerts);
    }

    boolean canPost() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return manager.areNotificationsEnabled();
    }

    static boolean needsPermission(String serializedState) {
        try {
            JSONObject state = new JSONObject(serializedState);
            JSONObject timer = state.optJSONObject("timer");
            JSONObject alerts = state.optJSONObject("alerts");
            return (timer != null && timer.optBoolean("running"))
                    || (alerts != null && alerts.optBoolean("enabled"));
        } catch (Exception ignored) {
            return false;
        }
    }

    void sync(String serializedState) {
        if (!canPost()) return;
        try {
            JSONObject state = new JSONObject(serializedState);
            syncTimer(state.optJSONObject("timer"));
            syncAlerts(state.optJSONObject("alerts"));
        } catch (Exception ignored) {
            // Dados inválidos da WebView não podem interromper a Activity.
        }
    }

    private void syncTimer(JSONObject timer) {
        if (timer == null || !timer.optBoolean("running")) {
            manager.cancel(TIMER_NOTIFICATION_ID);
            return;
        }

        String project = safeText(timer.optString("projectName"), "Sessão de foco");
        String subtask = safeText(timer.optString("subtaskTitle"), "");
        String target = subtask.isEmpty() ? project : project + " · " + subtask;
        long elapsedSeconds = Math.max(0, Math.min(timer.optLong("elapsedSeconds"), 10L * 365 * 24 * 60 * 60));
        long startedAt = System.currentTimeMillis() - elapsedSeconds * 1000L;

        Notification.Builder builder = builder(TIMER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(Color.parseColor("#A5C8FF"))
                .setContentTitle(target)
                .setContentText("Cronômetro em andamento")
                .setContentIntent(openAppIntent("home", TIMER_NOTIFICATION_ID))
                .setCategory("stopwatch")
                .setWhen(startedAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_LOW)
                .setSound(null);
        manager.notify(TIMER_NOTIFICATION_ID, builder.build());
    }

    private void syncAlerts(JSONObject alerts) {
        Set<String> previouslyActive = new HashSet<>(preferences.getStringSet(ACTIVE_ALERT_IDS, Collections.emptySet()));
        Set<String> seen = new HashSet<>(preferences.getStringSet(SEEN_ALERT_IDS, Collections.emptySet()));
        Set<String> currentlyActive = new HashSet<>();
        boolean enabled = alerts != null && alerts.optBoolean("enabled");
        JSONArray items = enabled ? alerts.optJSONArray("items") : null;

        if (items != null) {
            for (int index = 0; index < items.length(); index += 1) {
                JSONObject item = items.optJSONObject(index);
                if (item == null || item.optBoolean("read")) continue;
                String id = safeText(item.optString("id"), "");
                if (id.isEmpty()) continue;
                currentlyActive.add(id);
                if (seen.add(id)) postAlert(id, item);
            }
        }

        for (String id : previouslyActive) {
            if (!currentlyActive.contains(id)) manager.cancel(alertTag(id), ALERT_NOTIFICATION_ID);
        }

        if (seen.size() > 500) {
            seen.retainAll(currentlyActive);
        }
        preferences.edit()
                .putStringSet(ACTIVE_ALERT_IDS, new HashSet<>(currentlyActive))
                .putStringSet(SEEN_ALERT_IDS, new HashSet<>(seen))
                .apply();
    }

    private void postAlert(String id, JSONObject item) {
        String title = safeText(item.optString("title"), "FocusFlow");
        String message = safeText(item.optString("message"), "Você tem um novo alerta.");
        String target = safeText(item.optString("target"), "home");
        if (!(target.equals("home") || target.equals("project") || target.equals("stats"))) target = "home";
        String route = target.equals("project") ? "projects" : target;

        Notification notification = builder(ALERTS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(Color.parseColor("#A5C8FF"))
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new Notification.BigTextStyle().bigText(message))
                .setContentIntent(openAppIntent(route, id.hashCode()))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setGroup(ALERT_GROUP_KEY)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPriority(Notification.PRIORITY_DEFAULT)
                .build();
        manager.notify(alertTag(id), ALERT_NOTIFICATION_ID, notification);
    }

    private Notification.Builder builder(String channelId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return new Notification.Builder(context, channelId);
        return new Notification.Builder(context);
    }

    private PendingIntent openAppIntent(String route, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
                .putExtra(MainActivity.NOTIFICATION_ROUTE_EXTRA, route)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }

    private static String safeText(String value, String fallback) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) return fallback;
        return text.length() > 180 ? text.substring(0, 180) : text;
    }

    private static String alertTag(String id) {
        return "focusflow:" + id;
    }
}
