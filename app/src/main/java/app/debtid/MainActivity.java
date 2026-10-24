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
 * DebtID: um WebView que abre a página local (assets/index.html).
 * O app não pede permissão de internet; tudo roda no aparelho.
 * A página conversa com o Android pela ponte window.DebtIDApp.
 */
public class MainActivity extends Activity {
    private static final String PAGINA = "file:///android_asset/index.html";

    private WebView web;
    private boolean paginaPronta = false;
    private String textoPendente = null;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        boolean noturno = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        web.setBackgroundColor(noturno ? 0xFF0D0D0D : 0xFFFFFFFF);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);   // perfil e registros ficam no localStorage do app
        ajustes.setAllowFileAccess(false);    // a pasta assets continua acessível
        ajustes.setAllowContentAccess(false);

        web.setWebViewClient(new Navegador());
        web.addJavascriptInterface(new Ponte(), "DebtIDApp");
        setContentView(web);

        receber(getIntent());
        if (estado == null || web.restoreState(estado) == null) {
            web.loadUrl(PAGINA);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        receber(intent);
    }

    /** Texto compartilhado de outro app (ex.: WhatsApp → Compartilhar → DebtID). */
    private void receber(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String texto = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (texto == null || texto.trim().isEmpty()) return;
        textoPendente = texto;
        entregarPendente();
    }

    private void entregarPendente() {
        if (!paginaPronta || textoPendente == null || web == null) return;
        String js = "window.DebtIDAbrir && window.DebtIDAbrir(" + JSONObject.quote(textoPendente) + ")";
        textoPendente = null;
        web.evaluateJavascript(js, null);
    }

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        if (web != null) web.saveState(saida);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("DebtIDApp");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Links externos abrem no navegador; a página local fica no app. */
    private class Navegador extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest pedido) {
            Uri endereco = pedido.getUrl();
            if ("file".equals(endereco.getScheme())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, endereco));
            } catch (Exception e) {
                // nenhum app para abrir o link
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView vista, String url) {
            paginaPronta = true;
            entregarPendente();
        }
    }

    /** Funções que a página chama como window.DebtIDApp.* */
    private class Ponte {
        @JavascriptInterface
        public boolean copiar(String texto) {
            ClipboardManager area = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (area == null) return false;
            area.setPrimaryClip(ClipData.newPlainText("DebtID", texto));
            return true;
        }

        @JavascriptInterface
        public void compartilhar(final String texto) {
            runOnUiThread(() -> {
                Intent envio = new Intent(Intent.ACTION_SEND);
                envio.setType("text/plain");
                envio.putExtra(Intent.EXTRA_TEXT, texto);
                try {
                    startActivity(Intent.createChooser(envio, "Enviar código"));
                } catch (Exception e) {
                    // nenhum app para compartilhar
                }
            });
        }

        @JavascriptInterface
        public void imprimir(final String titulo) {
            runOnUiThread(() -> {
                if (web == null) return;
                PrintManager impressao = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (impressao == null) return;
                String nome = (titulo == null || titulo.trim().isEmpty()) ? "Recibo DebtID" : titulo;
                PrintDocumentAdapter adaptador = web.createPrintDocumentAdapter(nome);
                PrintAttributes atributos = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .build();
                impressao.print(nome, adaptador, atributos);
            });
        }

        /** Leitor de QR do Google Play Services: não precisa de permissão de câmera. */
        @JavascriptInterface
        public void lerQR() {
            runOnUiThread(() -> {
                GmsBarcodeScannerOptions opcoes = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                        .build();
                GmsBarcodeScanner leitor = GmsBarcodeScanning.getClient(MainActivity.this, opcoes);
                leitor.startScan()
                        .addOnSuccessListener(codigo -> devolverQR(codigo.getRawValue(), null))
                        .addOnCanceledListener(() -> devolverQR(null, null))
                        .addOnFailureListener(erro -> devolverQR(null,
                                "Não deu para abrir o leitor de QR. Cole o código."));
            });
        }

        /** Pinta as barras do sistema conforme a aparência e o tema da página. */
        @JavascriptInterface
        public void barras(final String topo, final boolean iconesEscurosTopo,
                           final String base, final boolean iconesEscurosBase) {
            runOnUiThread(() -> aplicarBarras(topo, iconesEscurosTopo, base, iconesEscurosBase));
        }
    }

    private void devolverQR(String texto, String erro) {
        if (web == null) return;
        String js = "window.__debtidQR && window.__debtidQR("
                + (texto == null ? "null" : JSONObject.quote(texto)) + ", "
                + (erro == null ? "null" : JSONObject.quote(erro)) + ")";
        web.evaluateJavascript(js, null);
    }

    @SuppressWarnings("deprecation")
    private void aplicarBarras(String topo, boolean escurosTopo, String base, boolean escurosBase) {
        int corTopo, corBase;
        try {
            corTopo = Color.parseColor(topo.trim());
            corBase = Color.parseColor(base.trim());
        } catch (Exception e) {
            return;
        }
        Window janela = getWindow();
        janela.setStatusBarColor(corTopo);
        janela.setNavigationBarColor(corBase);
        View decor = janela.getDecorView();
        int flags = decor.getSystemUiVisibility();
        flags = escurosTopo ? (flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
                : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        if (Build.VERSION.SDK_INT >= 26) {
            flags = escurosBase ? (flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
                    : (flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        decor.setSystemUiVisibility(flags);
        if (web != null) web.setBackgroundColor(corTopo);
    }
}
