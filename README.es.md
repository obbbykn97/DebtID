<p align="center"><img src="docs/logo.png" width="120" alt="Logo de DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <a href="README.pt-BR.md">Português</a> · <b>Español</b></p>

<p align="center">Calculadora y registro de préstamos en cualquier moneda. Las dos partes lo firman, y un código QR permite que cualquiera lo verifique en segundos.<br>
Funciona sin internet, sin cuenta y sin servidor, en 12 idiomas.</p>

---

## Descargar

Descarga `DebtID.apk` en la página de [versiones](https://github.com/obbbykn97/DebtID-multi/releases/latest) y abre el archivo en el teléfono para instalarlo. Si Android lo pide, permite instalar apps descargadas con el navegador.

También se puede usar en una computadora: descarga `web/dist/index.html` y ábrelo en el navegador.

## Cómo funciona

1. Quien registra el préstamo elige la moneda e indica el importe, la tasa y las fechas. Si quiere, también define cuotas, un recargo por atraso y una nota. DebtID genera un código firmado y lo muestra como código QR.
2. La otra persona lee el código QR en su DebtID, revisa los importes y confirma con su propia firma.
3. Quien registró lee de vuelta el QR de confirmación. Desde ese momento, el préstamo queda validado por los dos, en los dos teléfonos.
4. Cuando se devuelve el dinero, quien prestó firma un recibo y quien debe lee su QR. El pago aparece en los dos teléfonos, y quien pagó se queda con la prueba.

Cualquiera de los dos puede empezar el registro.

## Funciones

### Préstamos

- Más de 150 monedas, además de Bitcoin, Ether y Tether. La moneda forma parte del código firmado, y los importes en monedas distintas nunca se suman. La app no convierte monedas, porque no usa internet.
- Interés simple o compuesto, al mes, al año o una sola vez sobre el total. El total aparece mientras escribes y se redondea hacia arriba en la menor fracción de la moneda (centavo, satoshi…).
- Cuotas iguales, recargo e interés por atraso y una nota ("para la reparación del coche"), todo dentro del código firmado.
- La opción "Solo registrar" guarda el préstamo para tu propio control. La confirmación de la otra persona se puede pedir después.

### Recibos y pagos

- Quien prestó firma recibos de pago parcial, de finiquito y de cancelación. La cancelación sirve para un préstamo registrado por error, y después se puede crear el registro corregido.
- Cada registro muestra el saldo, las cuotas, los cargos por atraso y el historial del préstamo.
- El recibo sale listo para imprimir o guardar en PDF, con las dos firmas, los pagos y el código QR. En español, portugués e inglés trae los importes en letras; en los otros idiomas, en cifras con el nombre de la moneda.

### Organización

- Búsqueda, orden, filtros (atrasados, pagados, cancelados y otros), vista por persona y próximos vencimientos.
- Ganancia por período, con un gráfico mensual, una hoja de cálculo de todos los registros (CSV) y un informe en PDF.
- Recordatorios de vencimiento en Android, incluso con la app cerrada. En la pantalla de bloqueo solo aparece una línea neutra, sin nombres ni importes.

### Privacidad y seguridad

- Contactos reconocidos por su clave. La app avisa cuando un ID aparece por primera vez y alerta de una posible estafa cuando alguien usa el nombre de un contacto con otra clave. También se puede atar un préstamo a la clave de un contacto, y así solo esa persona puede confirmarlo.
- Bloqueo opcional, que se activa en Ajustes, con un PIN o, en Android 11 o posterior, con la huella, el rostro o el bloqueo de pantalla del teléfono. Con el bloqueo activado, la clave de firma se guarda cifrada.
- Copia de seguridad con contraseña del perfil, los registros y los contactos. La app recuerda hacer una copia cuando hay registros nuevos.

### Idiomas y apariencia

- 12 idiomas, los más hablados del mundo según Ethnologue: inglés, chino mandarín, hindi, español, árabe, francés, bengalí, portugués, indonesio, urdu, ruso y alemán. El árabe y el urdu se leen de derecha a izquierda, y la pantalla se refleja.
- Dos apariencias, *Profesional* y *Soft*, con tema claro y oscuro, opción de texto grande y 36 iconos de app para elegir.

## Seguridad

Lo que garantizan las firmas:

- Cada perfil tiene un par de claves ECDSA P-256, creado en el propio dispositivo. La clave privada solo sale de él dentro de la copia de seguridad, cifrada con AES-256-GCM y una clave derivada de la contraseña (PBKDF2 con 600 000 rondas).
- El código lleva los datos y las firmas. Si cambia cualquier parte, la firma deja de coincidir. Las pruebas cambian cada byte de un código y comprueban que todos los códigos alterados se rechazan.
- Un recibo apunta a la huella del préstamo y tiene que estar firmado por el acreedor de ese préstamo.

Los límites:

- La firma muestra qué clave firmó, no quién es la persona. Cualquiera puede crear un perfil con cualquier nombre, así que la primera vez verifica el ID completo en persona o en una videollamada.
- El registro vale más entre las dos personas involucradas. Para alguien de fuera, el código muestra que dos claves acordaron algo; relacionar una clave con una persona real requiere otras pruebas.
- Las fechas vienen del reloj de cada teléfono, y quien tenga un código puede leer los datos del préstamo. La firma impide cambios, pero no oculta nada.
- Sin el bloqueo, la clave solo está protegida por el aislamiento de apps de Android. Con el bloqueo por PIN, queda cifrada con el PIN; si alguien copia los datos de un teléfono con root, una computadora puede probar PIN cortos, así que un PIN más largo protege más. Con el bloqueo del teléfono, la clave que abre todo vive en el chip de seguridad de Android y solo funciona después de la huella, el rostro o el bloqueo de pantalla.
- No es una firma electrónica con certificado oficial. Es un registro informal de lo que acordaron dos personas, y la ley puede limitar los intereses y los recargos.

Para avisar de un fallo de seguridad, mira [SECURITY.md](SECURITY.md).

## Para quien quiera tocar el código

### Organización

```
web/src/           código de la página (HTML, CSS y JS, sin dependencias; textos en i18n.js)
web/src/idiomas/   textos de los otros nueve idiomas, un archivo por idioma
web/build.py       une todo en un solo archivo y calcula la Content Security Policy
web/dist/          el index.html listo, que se abre directamente en el navegador
web/test/          pruebas automáticas (node --test)
app/               app Android (una WebView que carga web/dist/index.html)
app/icones/        los colores de los iconos y el script que genera los archivos
docs/              logo
```

### Cómo ejecutarlo

- Después de editar `web/src`: `python3 web/build.py`
- Pruebas: `node --test web/test/*.test.mjs` (Node 20 o posterior).
- Después de cambiar los colores de los iconos: `python3 app/icones/gerar_icones.py` y luego `python3 web/build.py`
- Android: `./gradlew assembleRelease` (necesita el JDK 17 y el Android SDK).
- En GitHub Actions, cada push y cada pull request ejecutan las pruebas y generan el `DebtID.apk`. Los pushes a `main` lo publican en **Releases** cuando la clave de firma está configurada.

### Firma del APK

Android solo instala una actualización encima de la app cuando las dos versiones están firmadas con la misma clave. El workflow lee esa clave de dos secrets del repositorio:

| Secret | Valor |
| --- | --- |
| `DEBTID_KEYSTORE_B64` | el archivo de la keystore en base64 |
| `DEBTID_KEYSTORE_PASSWORD` | la contraseña de la keystore |

Para crear tu propia clave (en un fork, por ejemplo):

```bash
keytool -genkeypair -keystore debtid.jks -alias debtid -keyalg EC -groupname secp256r1 -validity 10950
base64 -w0 debtid.jks   # pega la salida en DEBTID_KEYSTORE_B64
```

Añade los dos en *Settings → Secrets and variables → Actions*. Nunca subas el archivo `.jks` al repositorio. Sin los secrets, el workflow genera igualmente un APK de prueba (en *Artifacts*), pero no publica una versión.

## Licencia

[MIT](LICENSE)
