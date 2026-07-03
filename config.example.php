<?php
/**
 * Plantilla de configuración de MOD Tracker.
 *
 * 1. Copia este archivo como `config.php` (que está en .gitignore y NO se sube al repo).
 * 2. Rellena tus credenciales reales de la base de datos.
 * 3. Alternativamente, define estas mismas claves como variables de entorno del
 *    servidor (tienen prioridad sobre config.php).
 */
return [
    'DB_HOST'    => 'TU_HOST',
    'DB_PORT'    => '3306',
    'DB_NAME'    => 'TU_BASE_DE_DATOS',
    'DB_USER'    => 'TU_USUARIO',
    'DB_PASS'    => 'TU_PASSWORD',
    'DB_CHARSET' => 'utf8mb4',

    // Token secreto para proteger el endpoint de guardado automático (cron_autosave).
    // Genera uno largo y aleatorio y úsalo en la URL del cron: ?action=cron_autosave&token=...
    'CRON_SECRET' => 'CAMBIA_ESTE_TOKEN_POR_UNO_SECRETO',
];
