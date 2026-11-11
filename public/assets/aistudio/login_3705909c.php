<?php
require_once 'auth.php';
require_once 'conexion.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $usuario = trim($data['usuario'] ?? '');
    $clave = trim($data['clave'] ?? '');

    if (empty($usuario) || empty($clave)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Complete todos los campos."]);
        exit();
    }

    $stmt = $conn->prepare("SELECT id, usuario, clave, nombre_completo FROM usuarios WHERE usuario = ?");
    $stmt->bind_param("s", $usuario);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        $loginValid = false;
        // Soporte para contraseñas en texto plano legacy o hash moderno
        if (password_verify($clave, $user['clave'])) {
            $loginValid = true;
        } elseif ($clave === $user['clave']) {
            // Migrar automáticamente a hash seguro
            $loginValid = true;
            $newHash = password_hash($clave, PASSWORD_DEFAULT);
            $updateHash = $conn->prepare("UPDATE usuarios SET clave = ? WHERE id = ?");
            $updateHash->bind_param("si", $newHash, $user['id']);
            $updateHash->execute();
        }

        if ($loginValid) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['usuario'];
            $_SESSION['fullname'] = $user['nombre_completo'];

            echo json_encode([
                "success" => true,
                "message" => "Bienvenido, " . $user['nombre_completo'],
                "fullname" => $user['nombre_completo']
            ]);
        } else {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Credenciales incorrectas."]);
        }
    } else {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Credenciales incorrectas."]);
    }
    exit();
}

$action = $_GET['action'] ?? '';
if ($method === 'GET' && $action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode(["logged" => true, "fullname" => $_SESSION['fullname']]);
    } else {
        echo json_encode(["logged" => false]);
    }
    exit();
}

if ($method === 'GET' && $action === 'logout') {
    session_destroy();
    echo json_encode(["success" => true]);
    exit();
}
?>