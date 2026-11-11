<?php
require_once 'conexion.php';

// Filtro opcional por fecha
$fecha = isset($_GET['fecha']) ? $_GET['fecha'] : date('Y-m-d');

$stmt = $conn->prepare("SELECT a.estudiante_dni, e.nombres, e.apellidos, a.fecha, a.hora, a.estado 
                            FROM asistencias a 
                            JOIN estudiantes e ON a.estudiante_dni = e.dni 
                            WHERE a.fecha = ?");
$stmt->bind_param("s", $fecha);
$stmt->execute();
$resultado = $stmt->get_result();
?>

<?php
session_start();
if (!isset($_SESSION['admin_logged']) || $_SESSION['admin_logged'] !== true) {
    header("Location: login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Asistencia - <?php echo $fecha; ?></title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 22px; color: #1a365d; }
        .header h2 { margin: 5px 0; font-size: 16px; color: #4a5568; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #cbd5e0; padding: 8px 12px; text-align: left; font-size: 14px; }
        th { background-color: #2b6cb0; color: white; }
        tr:nth-child(even) { background-color: #f7fafc; }
        .no-print { margin: 20px 0; text-align: center; }
        .btn { padding: 10px 20px; background: #319795; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .btn:hover { background: #2c7a7b; }
        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body>

    <div class="header">
        <h1>COLEGIO RICARDO BENTÍN 64935</h1>
        <h2>Reporte Oficial de Asistencia Diaria</h2>
        <p>Fecha del reporte: <strong><?php echo $fecha; ?></strong></p>
    </div>

    <div class="no-print">
        <button class="btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    </div>

    <table>
        <thead>
            <tr>
                <th>DNI</th>
                <th>Apellidos y Nombres</th>
                <th>Fecha</th>
                <th>Hora de Ingreso</th>
                <th>Estado</th>
            </tr>
        </thead>
        <tbody>
            <?php if ($resultado->num_rows > 0): ?>
                <?php while($row = $resultado->fetch_assoc()): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($row['estudiante_dni']); ?></td>
                        <td><?php echo htmlspecialchars($row['apellidos'] . ', ' . $row['nombres']); ?></td>
                        <td><?php echo htmlspecialchars($row['fecha']); ?></td>
                        <td><?php echo htmlspecialchars($row['hora']); ?></td>
                        <td><?php echo htmlspecialchars($row['estado']); ?></td>
                    </tr>
                <?php endwhile; ?>
            <?php else: ?>
                <tr>
                    <td colspan="5" style="text-align: center;">No hay registros de asistencia para esta fecha.</td>
                </tr>
            <?php endif; ?>
        </tbody>
    </table>

</body>
</html>