package app.debtid;

import android.annotation.TargetApi;
import android.content.Context;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.security.Key;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Keeps the data key that encrypts the signing key, with the Android Keystore (Android 11+).
 * The Keystore key never leaves the phone's secure hardware, and each use needs the fingerprint,
 * the face or the phone's screen lock right then. If the screen lock is removed, Android throws
 * the key away; the page then asks the person to restore the backup.
 */
@TargetApi(30)
final class Cofre {
    private static final String ALIAS = "debtid-chave-dados";
    private static final int AUTENTICADORES = BiometricManager.Authenticators.BIOMETRIC_STRONG
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    private Cofre() {
    }

    /** "ok", "sem-bloqueio" (the phone has no screen lock) or "indisponivel". */
    static String estado(Context context) {
        BiometricManager bm = context.getSystemService(BiometricManager.class);
        if (bm == null) return "indisponivel";
        int r = bm.canAuthenticate(AUTENTICADORES);
        if (r == BiometricManager.BIOMETRIC_SUCCESS) return "ok";
        if (r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return "sem-bloqueio";
        return "indisponivel";
    }

    /** Creates a new Keystore key and wraps the data key with it: answers {"iv","ct"} in base64. */
    static void guardar(MainActivity activity, String titulo, String subtitulo, String dadosB64) {
        final byte[] dados;
        final Cipher cipher;
        try {
            dados = Base64.decode(dadosB64, Base64.NO_WRAP);
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, novaChave());
        } catch (Exception e) {
            activity.returnCofre("erro", null);
            return;
        }
        pedir(activity, titulo, subtitulo, cipher, c -> {
            byte[] ct = c.doFinal(dados);
            JSONObject caixa = new JSONObject();
            caixa.put("iv", Base64.encodeToString(c.getIV(), Base64.NO_WRAP));
            caixa.put("ct", Base64.encodeToString(ct, Base64.NO_WRAP));
            return caixa.toString();
        });
    }

    /** Opens the data key: answers it in base64, or "invalida" when the Keystore key is gone. */
    static void abrir(MainActivity activity, String titulo, String subtitulo, String ivB64, String ctB64) {
        final byte[] ct;
        final Cipher cipher;
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            Key chave = ks.getKey(ALIAS, null);
            if (chave == null) {
                activity.returnCofre("invalida", null);
                return;
            }
            ct = Base64.decode(ctB64, Base64.NO_WRAP);
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, chave, new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)));
        } catch (KeyPermanentlyInvalidatedException e) {
            activity.returnCofre("invalida", null);
            return;
        } catch (Exception e) {
            activity.returnCofre("erro", null);
            return;
        }
        pedir(activity, titulo, subtitulo, cipher, c -> Base64.encodeToString(c.doFinal(ct), Base64.NO_WRAP));
    }

    static void apagar() {
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            ks.deleteEntry(ALIAS);
        } catch (Exception e) {
            // nothing to erase
        }
    }

    private static SecretKey novaChave() throws Exception {
        apagar();
        KeyGenerator gerador = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gerador.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                // every use asks again (timeout 0); a new fingerprint does not throw the key away
                .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL)
                .setInvalidatedByBiometricEnrollment(false)
                .build());
        return gerador.generateKey();
    }

    private interface Uso {
        String com(Cipher cipher) throws Exception;
    }

    /** Shows the system prompt (fingerprint, face or screen lock); the cipher works only after it. */
    private static void pedir(MainActivity activity, String titulo, String subtitulo, Cipher cipher, Uso uso) {
        Executor executor = activity.getMainExecutor();
        BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity)
                .setTitle(titulo == null || titulo.isEmpty() ? "DebtID" : titulo)
                .setAllowedAuthenticators(AUTENTICADORES);
        if (subtitulo != null && !subtitulo.isEmpty()) builder.setSubtitle(subtitulo);
        try {
            builder.build().authenticate(new BiometricPrompt.CryptoObject(cipher), new CancellationSignal(), executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            try {
                                activity.returnCofre("ok", uso.com(result.getCryptoObject().getCipher()));
                            } catch (Exception e) {
                                activity.returnCofre("erro", null);
                            }
                        }

                        @Override
                        public void onAuthenticationError(int codigo, CharSequence mensagem) {
                            boolean cancelou = codigo == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
                                    || codigo == BiometricPrompt.BIOMETRIC_ERROR_CANCELED;
                            activity.returnCofre(cancelou ? "cancelado" : "erro", null);
                        }
                    });
        } catch (Exception e) {
            activity.returnCofre("erro", null);
        }
    }
}
