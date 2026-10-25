package app.debtid;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives the app's own reminder alarms (not exported: no other app can send to it). */
public class AlarmeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Lembretes.ACAO.equals(intent.getAction())) return;
        Lembretes.mostrar(context,
                intent.getStringExtra(Lembretes.EXTRA_TITULO),
                intent.getStringExtra(Lembretes.EXTRA_TEXTO),
                intent.getStringExtra(Lembretes.EXTRA_PUBLICO));
    }
}
