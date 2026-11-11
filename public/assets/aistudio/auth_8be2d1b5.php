<?php
date_default_timezone_set('America/Lima');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function verificarSesionAPI() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "No autorizado. Inicie sesión."]);
        exit();
    }
}
?>