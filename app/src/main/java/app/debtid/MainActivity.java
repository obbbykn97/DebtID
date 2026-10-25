package app.debtid;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;

/**
 * DebtID is a WebView that loads the bundled page (assets/index.html).
 * The app requests no network permission: everything runs on the device.
 * The page talks to Android through the window.DebtIDApp bridge.
 */
public class MainActivity extends Activity {
    private static final String PAGE = "file:///android_asset/index.html";
    private static final String ASSETS = "file:///android_asset/";
    private static final int REQ_NOTIFICACOES = 1;
    private static final int REQ_ARQUIVO = 2;
    /** A shared text longer than this is not a DebtID code (codes have a few hundred characters). */
    private static final int MAX_TEXTO = 20000;

    private WebView webView;
    private boolean pageReady = false;
    private String pendingText = null;
    private String pendingFile = null;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        webView = new WebView(this);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        webView.setBackgroundColor(night ? 0xFF0D0D0D : 0xFFFFFFFF);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // the profile and records live in the app's localStorage
        settings.setAllowFileAccess(false);    // the assets folder stays reachable
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setSupportMultipleWindows(false);

        webView.setWebViewClient(new Client());
        webView.addJavascriptInterface(new Bridge(), "DebtIDApp");
        setContentView(webView);

        handleIntent(getIntent());
        if (savedState == null || webView.restoreState(savedState) == null) {
            webView.loadUrl(PAGE);
        }
        // reminders survive a reboot or an update; this also re-schedules them after the app was stopped
        Lembretes.reagendar(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** Text shared from another app (e.g. WhatsApp → Share → DebtID). It only fills the code field. */
    private void handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty() || text.length() > MAX_TEXTO) return;
        pendingText = text;
        deliverPending();
    }

    private void deliverPending() {
        if (!pageReady || pendingText == null || webView == null) return;
        String js = "window.DebtIDOpen && window.DebtIDOpen(" + JSONObject.quote(pendingText) + ")";
        pendingText = null;
        webView.evaluateJavascript(js, null);
    }

    private void js(String code) {
        if (webView != null) webView.evaluateJavascript(code, null);
    }

    // The page locks itself (PIN) after the app has been in the background for a while.
    @Override
    protected void onStart() {
        super.onStart();
        if (pageReady) js("window.DebtIDSegundoPlano && window.DebtIDSegundoPlano(false)");
    }

    @Override
    protected void onStop() {
        if (pageReady) js("window.DebtIDSegundoPlano && window.DebtIDSegundoPlano(true)");
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("DebtIDApp");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** Only the bundled page stays in the app; web links open in the browser; anything else is ignored. */
    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase();
            if ("file".equals(scheme)) return !url.toString().startsWith(ASSETS);
            if (!"https".equals(scheme) && !"http".equals(scheme) && !"mailto".equals(scheme)) return true;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (Exception e) {
                // no app can open this link
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageReady = true;
            deliverPending();
        }
    }

    /** Methods the page calls as window.DebtIDApp.* */
    private class Bridge {
        @JavascriptInterface
        public boolean copy(String text) {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) return false;
            clipboard.setPrimaryClip(ClipData.newPlainText("DebtID", text));
            return true;
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
                try {
                    startActivity(Intent.createChooser(send, "DebtID"));
                } catch (Exception e) {
                    // no app can share text
                }
            });
        }

        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(() -> {
                if (webView == null) return;
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) return;
                String name = (title == null || title.trim().isEmpty()) ? "DebtID" : title;
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .build();
                printManager.print(name, adapter, attributes);
            });
        }

        /** Google Play services code scanner: the app needs no camera permission. */
        @JavascriptInterface
        public void scanQR() {
            runOnUiThread(() -> {
                GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                        .build();
                GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(MainActivity.this, options);
                scanner.startScan()
                        .addOnSuccessListener(barcode -> returnQr(barcode.getRawValue(), null))
                        .addOnCanceledListener(() -> returnQr(null, null))
                        // the page shows the error message in the user's language
                        .addOnFailureListener(error -> returnQr(null, "scanner_unavailable"));
            });
        }

        /** Colors the status and navigation bars to match the page's look and theme. */
        @JavascriptInterface
        public void systemBars(final String top, final boolean darkIconsTop,
                               final String bottom, final boolean darkIconsBottom) {
            runOnUiThread(() -> applySystemBars(top, darkIconsTop, bottom, darkIconsBottom));
        }

        /** "ok" when a fingerprint or face is set up; "nenhuma" when not; "indisponivel" before Android 10. */
        @JavascriptInterface
        public String biometria() {
            if (Build.VERSION.SDK_INT < 29) return "indisponivel";
            return Biometria.disponivel(MainActivity.this) ? "ok" : "nenhuma";
        }

        /** Asks for the fingerprint or face; the answer goes to window.__debtidBio("ok"|"cancelado"|"erro"). */
        @JavascriptInterface
        public void autenticar(final String titulo, final String subtitulo, final String cancelar) {
            if (Build.VERSION.SDK_INT < 29) { returnBio("erro"); return; }
            runOnUiThread(() -> Biometria.autenticar(MainActivity.this, titulo, subtitulo, cancelar));
        }

        /** The next due-date reminders: a JSON list of { id, quando (ms), titulo, texto }, plus channel texts. */
        @JavascriptInterface
        public void lembretes(final String json) {
            Lembretes.agendar(MainActivity.this, json);
        }

        /** "ok", "pedir" (Android 13+ has not granted it yet) or "negado" (turned off in the settings). */
        @JavascriptInterface
        public String notificacoes() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return "pedir";
            }
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && !nm.areNotificationsEnabled() ? "negado" : "ok";
        }

        /** Asks for the notification permission; the answer goes to window.__debtidNotif(true|false). */
        @JavascriptInterface
        public void pedirNotificacoes() {
            runOnUiThread(MainActivity.this::pedirPermissaoNotificacoes);
        }

        /** Lets the person choose where to save a file (CSV); the result goes to window.__debtidArquivo. */
        @JavascriptInterface
        public void salvarArquivo(final String nome, final String tipo, final String texto) {
            runOnUiThread(() -> {
                pendingFile = texto;
                String mime = tipo == null ? "text/plain" : tipo.split(";")[0].trim();
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime.isEmpty() ? "text/plain" : mime)
                        .putExtra(Intent.EXTRA_TITLE, nome == null ? "debtid.csv" : nome);
                try {
                    startActivityForResult(intent, REQ_ARQUIVO);
                } catch (Exception e) {
                    pendingFile = null;
                    returnArquivo("false");
                }
            });
        }
    }

    private void pedirPermissaoNotificacoes() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            SharedPreferences prefs = getSharedPreferences("app", MODE_PRIVATE);
            boolean jaPediu = prefs.getBoolean("pediuNotificacoes", false);
            if (jaPediu && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                // denied for good: only the settings screen can turn it on now
                abrirAjustesNotificacoes();
                returnNotif(false);
                return;
            }
            prefs.edit().putBoolean("pediuNotificacoes", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICACOES);
            return;
        }
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && !nm.areNotificationsEnabled()) {
            abrirAjustesNotificacoes();
            returnNotif(false);
        } else {
            returnNotif(true);
        }
    }

    private void abrirAjustesNotificacoes() {
        Intent intent;
        if (Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
        }
        try {
            startActivity(intent);
        } catch (Exception e) {
            // no settings screen
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_NOTIFICACOES) return;
        boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        returnNotif(ok);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_ARQUIVO) return;
        String texto = pendingFile;
        pendingFile = null;
        Uri uri = data == null ? null : data.getData();
        if (resultCode != RESULT_OK || uri == null || texto == null) {
            returnArquivo("null"); // cancelled
            return;
        }
        try (OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new java.io.IOException("no stream");
            out.write(texto.getBytes(StandardCharsets.UTF_8));
            returnArquivo("true");
        } catch (Exception e) {
            returnArquivo("false");
        }
    }

    private void returnQr(String text, String error) {
        js("window.__debtidQR && window.__debtidQR("
                + (text == null ? "null" : JSONObject.quote(text)) + ", "
                + (error == null ? "null" : JSONObject.quote(error)) + ")");
    }

    void returnBio(String resultado) {
        runOnUiThread(() -> js("window.__debtidBio && window.__debtidBio(" + JSONObject.quote(resultado) + ")"));
    }

    private void returnNotif(boolean ok) {
        js("window.__debtidNotif && window.__debtidNotif(" + ok + ")");
    }

    private void returnArquivo(String resultado) {
        js("window.__debtidArquivo && window.__debtidArquivo(" + resultado + ")");
    }

    /** Fingerprint or face unlock (Android 10+), with the system's own prompt. */
    @TargetApi(29)
    private static final class Biometria {
        @SuppressWarnings("deprecation")
        static boolean disponivel(Context context) {
            BiometricManager bm = (BiometricManager) context.getSystemService(Context.BIOMETRIC_SERVICE);
            if (bm == null) return false;
            int r = Build.VERSION.SDK_INT >= 30
                    ? bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    : bm.canAuthenticate();
            return r == BiometricManager.BIOMETRIC_SUCCESS;
        }

        static void autenticar(final MainActivity activity, String titulo, String subtitulo, String cancelar) {
            Executor executor = activity.getMainExecutor();
            BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity)
                    .setTitle(titulo == null || titulo.isEmpty() ? "DebtID" : titulo)
                    .setNegativeButton(cancelar == null || cancelar.isEmpty() ? "PIN" : cancelar, executor,
                            (dialog, which) -> activity.returnBio("cancelado"));
            if (subtitulo != null && !subtitulo.isEmpty()) builder.setSubtitle(subtitulo);
            if (Build.VERSION.SDK_INT >= 30) {
                builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK);
            }
            try {
                builder.build().authenticate(new CancellationSignal(), executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        activity.returnBio("ok");
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        activity.returnBio("erro");
                    }
                });
            } catch (Exception e) {
                activity.returnBio("erro");
            }
        }
    }

    @SuppressWarnings("deprecation")
    private void applySystemBars(String top, boolean darkIconsTop, String bottom, boolean darkIconsBottom) {
        int topColor, bottomColor;
        try {
            topColor = Color.parseColor(top.trim());
            bottomColor = Color.parseColor(bottom.trim());
        } catch (Exception e) {
            return;
        }
        Window window = getWindow();
        window.setStatusBarColor(topColor);
        window.setNavigationBarColor(bottomColor);
        View decor = window.getDecorView();
        int flags = decor.getSystemUiVisibility();
        flags = darkIconsTop ? (flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
                : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        if (Build.VERSION.SDK_INT >= 26) {
            flags = darkIconsBottom ? (flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
                    : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        decor.setSystemUiVisibility(flags);
        if (webView != null) webView.setBackgroundColor(topColor);
    }
}
