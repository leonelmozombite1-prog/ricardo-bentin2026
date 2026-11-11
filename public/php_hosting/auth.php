<?php
/**
 * Control de Autenticación y Sesiones
 * Sistema de Asistencia Escolar - Colegio Ricardo Bentín 64935
 */

date_default_timezone_set('America/Lima');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Valida la sesión para peticiones AJAX / API JSON
 */
function verificarSesionAPI() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "No autorizado. Inicie sesión para continuar."]);
        exit();
    }
}

/**
 * Valida la sesión para vistas HTML directas (redirige a login.html si no está autenticado)
 */
function verificarSesionWeb() {
    if (!isset($_SESSION['user_id'])) {
        header("Location: login.html");
        exit();
    }
}
?>
