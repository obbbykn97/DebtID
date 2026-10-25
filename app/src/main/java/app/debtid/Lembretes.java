package app.debtid;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Due-date reminders. The page sends the next reminders (a JSON list); they are kept in the app's
 * private preferences and scheduled with AlarmManager, so they show up even with the app closed.
 * Nothing leaves the device and no network or exact-alarm permission is needed.
 */
final class Lembretes {
    static final String CANAL = "vencimentos";
    static final String EXTRA_TITULO = "titulo";
    static final String EXTRA_TEXTO = "texto";
    static final String EXTRA_PUBLICO = "publico";
    static final String ACAO = "app.debtid.LEMBRETE";
    private static final String PREFS = "lembretes";
    private static final int MAX = 60;

    private Lembretes() {}

    /** json: { canal, publico, lista: [{ id, quando, titulo, texto }] } or just the list. */
    static synchronized void agendar(Context context, String json) {
        Context app = context.getApplicationContext();
        prefs(app).edit().putString("json", json == null ? "[]" : json).apply();
        aplicar(app, json);
    }

    /** Schedules again what was saved (after a reboot, an update or when the app opens). */
    static synchronized void reagendar(Context context) {
        Context app = context.getApplicationContext();
        aplicar(app, prefs(app).getString("json", "[]"));
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void aplicar(Context c, String json) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences p = prefs(c);
        // cancel what was scheduled before
        try {
            JSONArray antigos = new JSONArray(p.getString("ids", "[]"));
            for (int i = 0; i < antigos.length(); i++) {
                PendingIntent pi = PendingIntent.getBroadcast(c, antigos.getInt(i), intent(c, null, null, null),
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            }
        } catch (Exception e) {
            // nothing to cancel
        }
        JSONArray ids = new JSONArray();
        try {
            JSONArray lista;
            String canal = null, publico = null;
            String texto = json == null ? "[]" : json.trim();
            if (texto.startsWith("{")) {
                JSONObject o = new JSONObject(texto);
                lista = o.optJSONArray("lista");
                canal = o.optString("canal", null);
                publico = o.optString("publico", null);
            } else {
                lista = new JSONArray(texto);
            }
            if (lista == null) lista = new JSONArray();
            if (canal != null) p.edit().putString("canal", canal).apply();
            long agora = System.currentTimeMillis();
            for (int i = 0; i < lista.length() && ids.length() < MAX; i++) {
                JSONObject r = lista.getJSONObject(i);
                long quando = r.optLong("quando", 0);
                if (quando <= agora) continue;
                int codigo = r.optString("id", String.valueOf(i)).hashCode();
                PendingIntent pi = PendingIntent.getBroadcast(c, codigo,
                        intent(c, r.optString("titulo", "DebtID"), r.optString("texto", ""), publico),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi);
                ids.put(codigo);
            }
        } catch (Exception e) {
            // bad data from the page: schedule nothing
        }
        p.edit().putString("ids", ids.toString()).apply();
    }

    private static Intent intent(Context c, String titulo, String texto, String publico) {
        Intent i = new Intent(c, AlarmeReceiver.class).setAction(ACAO);
        if (titulo != null) i.putExtra(EXTRA_TITULO, titulo);
        if (texto != null) i.putExtra(EXTRA_TEXTO, texto);
        if (publico != null) i.putExtra(EXTRA_PUBLICO, publico);
        return i;
    }

    /** Shows one reminder. On the lock screen only a neutral line appears (no names or amounts). */
    @SuppressWarnings("deprecation")
    static void mostrar(Context c, String titulo, String texto, String publico) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String nomeCanal = prefs(c).getString("canal", "DebtID");
        Notification.Builder b, pub;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel canal = new NotificationChannel(CANAL, nomeCanal, NotificationManager.IMPORTANCE_DEFAULT);
            canal.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(canal);
            b = new Notification.Builder(c, CANAL);
            pub = new Notification.Builder(c, CANAL);
        } else {
            b = new Notification.Builder(c);
            pub = new Notification.Builder(c);
        }
        Intent abrir = new Intent(c, MainActivity.class)
                .setAction(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent toque = PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        pub.setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle("DebtID")
                .setContentText(publico == null || publico.isEmpty() ? "DebtID" : publico);
        b.setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle(titulo == null ? "DebtID" : titulo)
                .setContentText(texto == null ? "" : texto)
                .setStyle(new Notification.BigTextStyle().bigText(texto == null ? "" : texto))
                .setContentIntent(toque)
                .setAutoCancel(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(pub.build());
        try {
            nm.notify((titulo + "|" + texto).hashCode(), b.build());
        } catch (SecurityException e) {
            // notifications not allowed
        }
    }
}
