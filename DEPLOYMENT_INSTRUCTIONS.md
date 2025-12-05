# Instrucciones de Despliegue para HoneySmashBurger en Render

Para desplegar tu aplicación HoneySmashBurger en Render y asegurar que los códigos funcionen correctamente, sigue estos pasos detallados:

## 1. Prepara tu Repositorio de Git

Asegúrate de que todo tu código esté en un repositorio de Git (por ejemplo, GitHub, GitLab, Bitbucket). Esto incluye:
- `server.js`
- `game.js`
- `index.html`
- `package.json`
- `package-lock.json`
- La carpeta `assets/`
- Cualquier otro archivo necesario para que la aplicación funcione.

Si aún no tienes un repositorio, inicializa uno en la carpeta `HoneySmashBurger-master` y sube todo a un nuevo repositorio remoto.

## 2. Crea una Cuenta en Render

Si no tienes una, ve a [https://render.com/](https://render.com/) y crea una cuenta. Puedes registrarte usando tu cuenta de GitHub o GitLab para una integración más sencilla.

## 3. Crea un Nuevo Servicio Web en Render

a.  En tu panel de control de Render, haz clic en el botón **"New"** (Nuevo) y selecciona **"Web Service"** (Servicio Web).
b.  **Conecta tu repositorio de Git:** Render te pedirá autorización para acceder a tus repositorios. Concede los permisos necesarios.
c.  **Selecciona el repositorio:** Elige el repositorio que contiene tu proyecto HoneySmashBurger.

## 4. Configura tu Servicio Web

Render intentará detectar automáticamente la configuración, pero es crucial verificar y ajustar lo siguiente:

-   **Name (Nombre):** Dale un nombre único a tu servicio (ej. `honeysmashburger-game`).
-   **Root Directory (Directorio Raíz):** Si tu código está en una subcarpeta dentro de tu repositorio (por ejemplo, `HoneySmashBurger-master` si tu repositorio es `ultimo`), asegúrate de especificar esa subcarpeta aquí. En tu caso, si el repositorio es `ultimo` y el código está en `HoneySmashBurger-master`, el directorio raíz sería `HoneySmashBurger-master`.
-   **Runtime:** Selecciona **Node.js**.
-   **Build Command (Comando de Construcción):** `npm install`
-   **Start Command (Comando de Inicio):** `node server.js` (Esto ya está definido en tu `package.json`, lo cual es ideal).
-   **Plan Type (Tipo de Plan):** Para empezar, puedes usar el plan "Free" (Gratis) o "Starter" (Inicio). Ten en cuenta las limitaciones del plan gratuito.

## 5. Configura las Variables de Entorno (Environment Variables)

¡Este paso es **CRÍTICO** para la conexión a MongoDB!

a.  Ve a la sección **"Environment"** (Entorno) de la configuración de tu servicio en Render.
b.  Añade una nueva variable de entorno:
    *   **Key (Clave):** `MONGODB_URI`
    *   **Value (Valor):** Pega aquí la cadena de conexión **completa** a tu base de datos MongoDB Atlas. Asegúrate de que incluya tu usuario y contraseña, y que sea la cadena de conexión SRV (que comienza con `mongodb+srv://...`).

    **Ejemplo de valor:** `mongodb+srv://<tu_usuario>:<tu_contraseña>@cluster0.vo6lrlw.mongodb.net/?appName=Cluster0`

    **¡Importante!** No uses la cadena de conexión que tienes en tu `server.js` directamente en Render, ya que contiene credenciales. Render te permite mantenerlas seguras como variables de entorno, lo cual es una buena práctica de seguridad.

## 6. Despliega el Servicio

Una vez que hayas configurado todo, haz clic en **"Create Web Service"** (Crear Servicio Web). Render tomará tu código, instalará las dependencias y ejecutará el comando de inicio. Podrás ver los logs del despliegue en tiempo real.

## 7. Verifica el Despliegue

Una vez que el despliegue esté completo y el estado de tu servicio sea "Live" (En vivo), Render te proporcionará una URL pública para tu aplicación.

-   Abre esa URL en tu navegador para probar el juego.
-   Verifica que la validación de códigos funcione correctamente.
-   Asegúrate de que las puntuaciones se guarden y el ranking se muestre sin problemas.

## Consideraciones Adicionales:

-   **Base de Datos MongoDB:** Asegúrate de que tu base de datos MongoDB Atlas esté configurada para permitir conexiones desde cualquier IP (o al menos desde las IPs de Render, aunque la opción "Allow Access from Anywhere" es más sencilla para empezar en la configuración de seguridad de tu clúster de Atlas).
-   **Escalabilidad:** Para un juego con muchos usuarios, considera los planes de pago de Render y MongoDB Atlas para mayor rendimiento y escalabilidad.
-   **Seguridad:** Aunque Render maneja las variables de entorno de forma segura, siempre es una buena práctica no exponer credenciales directamente en el código fuente.

Si tienes alguna pregunta durante el proceso o si encuentras algún problema, no dudes en preguntar.
