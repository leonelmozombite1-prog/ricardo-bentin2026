<?php
/**
 * Login y Gestión de Sesión
 * Sistema de Asistencia Escolar - Colegio Ricardo Bentín 64935
 */

require_once 'auth.php';
require_once 'conexion.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// 1. INICIAR SESIÓN (POST)
if ($method === 'POST' && ($action === '' || $action === 'login')) {
    $rawInput = file_get_contents("php://input");
    $data = json_decode($rawInput, true);

    $usuario = trim($data['usuario'] ?? $_POST['usuario'] ?? '');
    $clave = trim($data['clave'] ?? $_POST['clave'] ?? '');

    if (empty($usuario) || empty($clave)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Por favor complete todos los campos."]);
        exit();
    }

    $stmt = $conn->prepare("SELECT id, usuario, clave, nombre_completo FROM usuarios WHERE usuario = ? LIMIT 1");
    $stmt->bind_param("s", $usuario);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        $loginValid = false;

        // Soporte tanto para hash bcrypt como texto plano legacy (con auto-migración)
        if (password_verify($clave, $user['clave'])) {
            $loginValid = true;
        } elseif ($clave === $user['clave']) {
            $loginValid = true;
            // Migrar a hash seguro para mayor seguridad
            $newHash = password_hash($clave, PASSWORD_DEFAULT);
            $updateHash = $conn->prepare("UPDATE usuarios SET clave = ? WHERE id = ?");
            $updateHash->bind_param("si", $newHash, $user['id']);
            $updateHash->execute();
        }

        if ($loginValid) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['usuario'];
            $_SESSION['fullname'] = $user['nombre_completo'];
            $_SESSION['admin_logged'] = true; // Compatibilidad con reporte_pdf.php

            echo json_encode([
                "success" => true,
                "message" => "Bienvenido/a, " . $user['nombre_completo'],
                "fullname" => $user['nombre_completo']
            ]);
        } else {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Contraseña incorrecta."]);
        }
    } else {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Usuario no encontrado."]);
    }
    exit();
}

// 2. VERIFICAR SESIÓN ACTIVA (GET)
if ($method === 'GET' && $action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            "logged" => true,
            "username" => $_SESSION['username'] ?? '',
            "fullname" => $_SESSION['fullname'] ?? 'Administrador'
        ]);
    } else {
        echo json_encode(["logged" => false]);
    }
    exit();
}

// 3. CERRAR SESIÓN (GET o POST)
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    echo json_encode(["success" => true, "message" => "Sesión cerrada correctamente."]);
    exit();
}
?>
