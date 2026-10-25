<p align="center"><img src="docs/logo.png" width="120" alt="Logo de DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <a href="README.pt-BR.md">Português</a> · <b>Español</b></p>

<p align="center">Calculadora y registro de préstamos en cualquier moneda. Las dos partes lo firman, y un código QR permite que cualquiera lo verifique en segundos.<br>
Todo funciona en el dispositivo, sin servidor, sin cuenta y sin internet.</p>

---

## Cómo funciona

1. Quien registra el préstamo elige la moneda e indica el importe, la tasa y las fechas. Si quiere, también define cuotas, un recargo por atraso y una nota. DebtID genera un código firmado y lo muestra como código QR.
2. La otra persona lee el código QR en su DebtID, revisa los importes y confirma con su propia firma.
3. Quien registró lee de vuelta el QR de confirmación. Desde ese momento, el préstamo queda validado por los dos, en los dos teléfonos.
4. Cuando se devuelve el dinero, quien prestó firma un recibo (de un pago parcial, del finiquito o de una cancelación) y quien debe lee su QR. El pago aparece en los dos teléfonos y quien pagó se queda con la prueba.

Cualquiera de los dos puede empezar el registro.

## Funciones

- Más de 150 monedas, además de Bitcoin (la moneda predeterminada), Ether y Tether, con búsqueda por nombre o código. La moneda predeterminada está en *Ajustes*, y en cada préstamo se puede elegir otra. La moneda forma parte del código firmado. El total se redondea hacia arriba en la menor fracción de la moneda (centavo, satoshi…) y los importes en monedas distintas nunca se suman. La app no convierte monedas, porque no usa internet.
- Interés simple o compuesto, aplicado una vez sobre todo el préstamo, al mes (mes comercial de 30 días) o al año. El total aparece mientras escribes.
- Cuotas iguales, con vencimientos repartidos hasta la fecha de pago. El recargo por atraso se aplica una vez y el interés por atraso corre al mes sobre lo que falte pagar después de cada vencimiento. Todo eso va dentro del código firmado.
- Una nota en el préstamo ("para la reparación del coche"), también firmada.
- Recibos firmados por quien prestó: pago parcial, finiquito y cancelación. La cancelación sirve para un préstamo registrado por error, y después se puede crear el registro corregido. Cada registro muestra el saldo, cada cuota y los cargos por atraso.
- Contactos reconocidos por su clave. DebtID avisa cuando un ID nunca apareció antes y alerta de una posible estafa cuando alguien usa el nombre de un contacto con otra clave. También se puede atar un préstamo a la clave de un contacto, y así solo esa persona puede confirmarlo.
- Recibo con los importes en letras, las dos firmas, los pagos y el código QR, listo para imprimir o guardar en PDF.
- Lista de registros con búsqueda, orden y filtros (atrasados, pendientes, validados, solo registro, pagados y cancelados), vista por persona, próximos vencimientos y el historial de cada préstamo.
- Ganancia por período: la recibida cuenta la parte de interés de cada pago, por la fecha del pago, y la por recibir cuenta lo que falta en los préstamos pendientes. Se puede ver el mes, el año, todo o un rango de fechas, con un gráfico mensual que también se abre como tabla. Quien debe ve los intereses pagados y por pagar.
- Hoja de cálculo de todos los registros (CSV) e informe del período para imprimir (PDF).
- Recordatorios de vencimiento en Android, incluso con la app cerrada. En la pantalla de bloqueo solo aparece una línea neutra, sin nombres ni importes.
- Bloqueo con PIN, y con huella o rostro en Android 10 o posterior. El PIN también se pide antes de las copias de seguridad, de restaurar y de borrar los datos.
- La opción "Solo registrar", que guarda el préstamo para tu propio control. La confirmación de la otra persona se puede pedir después.
- Español, portugués e inglés. La app pregunta el idioma la primera vez y se puede cambiar en *Ajustes*, donde también está la opción de texto grande.
- Dos apariencias, *Profesional* y *Soft*, cada una con tema claro y oscuro, y 36 iconos de app para elegir.
- Copia de seguridad con contraseña del perfil, los registros y los contactos. La app recuerda hacer una copia cuando hay registros nuevos.
- En Android, el QR se lee con Google Play services (la app no pide permiso de cámara) y los códigos pueden llegar desde el menú *Compartir* de otra app.

## Seguridad

Lo que garantizan las firmas:

- Cada perfil tiene un par de claves ECDSA P-256, creado en el propio dispositivo con la Web Crypto API. La clave privada solo sale del dispositivo dentro de la copia de seguridad, cifrada con AES-256-GCM y una clave derivada de la contraseña (PBKDF2 con 600 000 rondas). Las copias hechas con versiones anteriores siguen abriéndose.
- El código lleva los datos y las firmas. Si cambia cualquier parte, la firma deja de coincidir. Las pruebas cambian cada byte de un código y comprueban que todos los códigos alterados se rechazan. Una verificación de 4 caracteres detecta errores al escribir. Los códigos nuevos usan una sola forma de firma, así que no se pueden convertir en un segundo código válido.
- Un recibo apunta a la huella del préstamo y tiene que estar firmado por el acreedor de ese préstamo.

Los límites:

- La firma muestra qué clave firmó. No muestra quién es la persona, y cualquiera puede crear un perfil con cualquier nombre. Por eso la app muestra el ID completo (24 caracteres, empezando por el ID corto que aparece en los recibos), guarda los contactos por su clave y avisa cuando un ID es nuevo o cuando el nombre de un contacto aparece con otra clave. La primera vez, verifica el ID completo en persona o en una videollamada.
- El registro vale más entre las dos personas involucradas. Para alguien de fuera (la familia, un juez), el código muestra que dos claves acordaron algo. Relacionar una clave con una persona real requiere otras pruebas.
- Las fechas vienen del reloj de cada teléfono.
- Quien tenga un código puede leer los datos del préstamo. La firma impide cambios, pero no oculta nada.
- Los códigos de la primera versión (v1) no tienen firma. Todavía se abren, con un aviso, y no sirven como prueba.
- Las claves están protegidas por el aislamiento de apps de Android, sin un cifrado extra encima. En un teléfono con root o comprometido, se pueden filtrar. El bloqueo de la app protege frente a quien tome tu teléfono desbloqueado.
- La página solo ejecuta sus propios scripts (Content Security Policy con el hash de cada script) y la app no tiene permiso de internet.
- No es una firma electrónica con certificado oficial. Es un registro informal de lo que acordaron dos personas. La ley puede limitar los intereses y los recargos.

Para avisar de un fallo de seguridad, mira [SECURITY.md](SECURITY.md).

## Organización del proyecto

```
web/src/        código de la página (HTML, CSS y JS, sin dependencias; textos en i18n.js)
web/build.py    une todo en un solo archivo y calcula la Content Security Policy
web/dist/       el index.html listo, que se abre directamente en el navegador
web/test/       pruebas automáticas del núcleo y de los textos (node --test)
app/            app Android (una WebView que carga web/dist/index.html, más recordatorios, desbloqueo e iconos)
app/icones/     los colores de los iconos (icones.json) y el script que genera los archivos
docs/           logo
```

## Cómo ejecutarlo

- En el navegador: abre `web/dist/index.html`.
- Después de editar `web/src`: `python3 web/build.py`
- Pruebas: `node --test web/test/*.test.mjs` (Node 20 o posterior).
- Después de cambiar los colores de los iconos: `python3 app/icones/gerar_icones.py` y luego `python3 web/build.py`
- Android: `./gradlew assembleRelease` (necesita el JDK 17 y el Android SDK).
- En GitHub Actions, cada push y cada pull request ejecutan las pruebas y generan el `DebtID.apk`. Los pushes a `main` lo publican en **Releases** cuando la clave de firma está configurada.

## Firma del APK

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

Añade los dos en *Settings → Secrets and variables → Actions*. Nunca subas el archivo `.jks` al repositorio. Sin los secrets, el workflow genera igualmente un APK de prueba (en *Artifacts*), pero no publica una release.

## Licencia

[MIT](LICENSE)
