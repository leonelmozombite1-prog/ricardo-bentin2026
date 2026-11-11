<?php
/**
 * Conexión a la Base de Datos MySQL / MariaDB
 * Sistema de Asistencia Escolar - Colegio Ricardo Bentín 64935
 */

// Zona horaria oficial para registro de asistencias
date_default_timezone_set('America/Lima');

// Configuración de credenciales de base de datos
// Ajusta estos valores según tu hosting (cPanel) o XAMPP local
$host = "localhost";
$user = "root";                    // En XAMPP suele ser 'root'. En cPanel ej. 'usuario_colegio'
$password = "";                    // En XAMPP suele estar vacío. En cPanel ej. 'tu_password_segura'
$dbname = "colegio_asistencia";    // Nombre de la base de datos creada en phpMyAdmin

$conn = new mysqli($host, $user, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "error" => "Error de conexión a la base de datos: " . $conn->connect_error,
        "ayuda" => "Verifica que el nombre de la base de datos, usuario y contraseña en conexion.php coincidan con los de phpMyAdmin."
    ]);
    exit();
}

// Configurar juego de caracteres UTF-8 para tildes y eñes
$conn->set_charset("utf8mb4");
?>
