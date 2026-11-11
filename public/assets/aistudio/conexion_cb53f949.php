<?php
// Configurar zona horaria de Perú
date_default_timezone_set('America/Lima');

$host = "localhost";
$user = "root";       // Usuario por defecto en XAMPP
$password = "";       // Contraseña vacía por defecto en XAMPP[cite: 2]
$dbname = "colegio_asistencia"; // Nombre exacto visto en phpMyAdmin[cite: 3]

$conn = new mysqli($host, $user, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Error de conexión a la base de datos: " . $conn->connect_error]);
    exit();
}

$conn->set_charset("utf8mb4");
?>