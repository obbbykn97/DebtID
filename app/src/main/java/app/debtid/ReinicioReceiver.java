package app.debtid;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Alarms are cleared when the phone restarts or the app is updated, so the saved reminders are
 * scheduled again. Only these two system broadcasts are handled; only the system can send them.
 */
public class ReinicioReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String acao = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(acao) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(acao)) {
            Lembretes.reagendar(context);
        }
    }
}
