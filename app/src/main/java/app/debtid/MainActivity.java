package app.debtid;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
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

/**
 * DebtID is a WebView that loads the bundled page (assets/index.html).
 * The app requests no network permission: everything runs on the device.
 * The page talks to Android through the window.DebtIDApp bridge.
 */
public class MainActivity extends Activity {
    private static final String PAGE = "file:///android_asset/index.html";

    private WebView webView;
    private boolean pageReady = false;
    private String pendingText = null;

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

        webView.setWebViewClient(new Client());
        webView.addJavascriptInterface(new Bridge(), "DebtIDApp");
        setContentView(webView);

        handleIntent(getIntent());
        if (savedState == null || webView.restoreState(savedState) == null) {
            webView.loadUrl(PAGE);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** Text shared from another app (e.g. WhatsApp → Share → DebtID). */
    private void handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;
        pendingText = text;
        deliverPending();
    }

    private void deliverPending() {
        if (!pageReady || pendingText == null || webView == null) return;
        String js = "window.DebtIDOpen && window.DebtIDOpen(" + JSONObject.quote(pendingText) + ")";
        pendingText = null;
        webView.evaluateJavascript(js, null);
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

    /** External links open in the browser; the bundled page stays in the app. */
    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if ("file".equals(url.getScheme())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
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
    }

    private void returnQr(String text, String error) {
        if (webView == null) return;
        String js = "window.__debtidQR && window.__debtidQR("
                + (text == null ? "null" : JSONObject.quote(text)) + ", "
                + (error == null ? "null" : JSONObject.quote(error)) + ")";
        webView.evaluateJavascript(js, null);
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
