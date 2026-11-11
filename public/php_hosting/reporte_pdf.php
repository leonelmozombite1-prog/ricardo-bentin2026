<?php
/**
 * Reporte Oficial de Asistencia en PDF / Vista de Impresión
 * Colegio Ricardo Bentín 64935
 */

require_once 'auth.php';
require_once 'conexion.php';

// Validar sesión antes de mostrar cualquier dato sensible
if (!isset($_SESSION['user_id']) && !isset($_SESSION['admin_logged'])) {
    header("Location: login.html");
    exit();
}

$fecha = isset($_GET['fecha']) && !empty($_GET['fecha']) ? $_GET['fecha'] : date('Y-m-d');
$filtroGrado = isset($_GET['grado']) ? trim($_GET['grado']) : 'todos';
$filtroSeccion = isset($_GET['seccion']) ? trim($_GET['seccion']) : 'todos';

// Obtener datos del colegio
$cfgRes = $conn->query("SELECT nombre_colegio, hora_limite FROM configuracion WHERE id = 1");
$config = $cfgRes ? $cfgRes->fetch_assoc() : ['nombre_colegio' => 'Colegio Ricardo Bentín 64935', 'hora_limite' => '08:00:00'];
$nombreColegio = $config['nombre_colegio'] ?? 'Colegio Ricardo Bentín 64935';

// Consulta corregida con la columna real 'nombre' de estudiantes
$sql = "SELECT e.dni, e.nombre, e.grado, e.seccion, a.fecha, a.hora, 
               COALESCE(a.estado, 'Ausente') as estado, a.justificacion
        FROM estudiantes e
        LEFT JOIN asistencias a ON e.dni = a.estudiante_dni AND a.fecha = ?
        WHERE 1=1 ";

$params = [$fecha];
$types = "s";

if ($filtroGrado !== 'todos' && !empty($filtroGrado)) {
    $sql .= " AND e.grado = ? ";
    $params[] = $filtroGrado;
    $types .= "s";
}
if ($filtroSeccion !== 'todos' && !empty($filtroSeccion)) {
    $sql .= " AND e.seccion = ? ";
    $params[] = $filtroSeccion;
    $types .= "s";
}

$sql .= " ORDER BY e.grado ASC, e.seccion ASC, e.nombre ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$resultado = $stmt->get_result();

$presentes = 0;
$tardanzas = 0;
$ausentes = 0;
$filas = [];

while ($row = $resultado->fetch_assoc()) {
    if ($row['estado'] === 'Presente') $presentes++;
    elseif ($row['estado'] === 'Tarde') $tardanzas++;
    else $ausentes++;
    $filas[] = $row;
}
$totalAlumnos = count($filas);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Asistencia - <?php echo htmlspecialchars($fecha); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Cinzel:wght@700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', Arial, sans-serif; }
        body { color: #1e293b; margin: 20px; background: #fff; }
        .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #0f172a; padding-bottom: 15px; }
        .header h1 { margin: 0; font-size: 24px; font-family: 'Cinzel', serif; color: #0b1c3d; letter-spacing: 1px; }
        .header h2 { margin: 6px 0 2px 0; font-size: 16px; color: #475569; text-transform: uppercase; font-weight: 700; }
        .header p { margin: 4px 0 0 0; font-size: 14px; color: #64748b; }
        
        .stats-box {
            display: flex;
            justify-content: space-around;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
        }
        .stat-item { text-align: center; }
        .stat-item span { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .stat-item strong { font-size: 20px; font-weight: 800; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
        th { background-color: #0b1c3d; color: #ffffff; font-weight: 700; font-size: 12px; text-transform: uppercase; }
        tr:nth-child(even) { background-color: #f8fafc; }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .badge-presente { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .badge-tarde { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .badge-ausente { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

        .no-print {
            margin: 15px 0 25px 0;
            display: flex;
            gap: 12px;
            justify-content: center;
            align-items: center;
        }
        .btn {
            padding: 10px 20px;
            background: #0b1c3d;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn:hover { background: #1e3a6e; }
        .btn-secondary { background: #64748b; }
        .btn-secondary:hover { background: #475569; }

        .filter-select {
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
        }

        .firmas {
            margin-top: 60px;
            display: flex;
            justify-content: space-around;
            text-align: center;
            page-break-inside: avoid;
        }
        .linea-firma {
            border-top: 1px solid #000;
            width: 220px;
            padding-top: 6px;
            font-size: 12px;
            font-weight: 600;
        }

        @media print {
            .no-print { display: none !important; }
            body { margin: 0; padding: 10px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            @page { size: A4 portrait; margin: 1cm; }
        }
    </style>
</head>
<body>

    <div class="no-print">
        <form method="GET" style="display: flex; gap: 10px; align-items: center;">
            <input type="date" name="fecha" value="<?php echo htmlspecialchars($fecha); ?>" class="filter-select">
            <select name="grado" class="filter-select">
                <option value="todos">Todos los Grados</option>
                <option value="1" <?php if ($filtroGrado === '1') echo 'selected'; ?>>1°</option>
                <option value="2" <?php if ($filtroGrado === '2') echo 'selected'; ?>>2°</option>
                <option value="3" <?php if ($filtroGrado === '3') echo 'selected'; ?>>3°</option>
                <option value="4" <?php if ($filtroGrado === '4') echo 'selected'; ?>>4°</option>
                <option value="5" <?php if ($filtroGrado === '5') echo 'selected'; ?>>5°</option>
            </select>
            <select name="seccion" class="filter-select">
                <option value="todos">Todas las Secciones</option>
                <option value="A" <?php if ($filtroSeccion === 'A') echo 'selected'; ?>>Sección A</option>
                <option value="B" <?php if ($filtroSeccion === 'B') echo 'selected'; ?>>Sección B</option>
                <option value="C" <?php if ($filtroSeccion === 'C') echo 'selected'; ?>>Sección C</option>
                <option value="D" <?php if ($filtroSeccion === 'D') echo 'selected'; ?>>Sección D</option>
            </select>
            <button type="submit" class="btn btn-secondary">Filtrar</button>
        </form>
        <button class="btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
        <a href="index.html" class="btn btn-secondary">← Volver al Panel</a>
    </div>

    <div class="header">
        <h1><?php echo htmlspecialchars($nombreColegio); ?></h1>
        <h2>Parte Diario Oficial de Asistencia Estudiantil</h2>
        <p>Fecha de Control: <strong><?php echo date('d/m/Y', strtotime($fecha)); ?></strong> | Generado el <?php echo date('d/m/Y H:i'); ?></p>
    </div>

    <div class="stats-box">
        <div class="stat-item">
            <span>Matrícula Total</span>
            <strong style="color: #0b1c3d;"><?php echo $totalAlumnos; ?></strong>
        </div>
        <div class="stat-item">
            <span>Presentes</span>
            <strong style="color: #15803d;"><?php echo $presentes; ?></strong>
        </div>
        <div class="stat-item">
            <span>Tardanzas</span>
            <strong style="color: #b45309;"><?php echo $tardanzas; ?></strong>
        </div>
        <div class="stat-item">
            <span>Ausentes</span>
            <strong style="color: #b91c1c;"><?php echo $ausentes; ?></strong>
        </div>
        <div class="stat-item">
            <span>% Asistencia</span>
            <strong style="color: #0284c7;">
                <?php echo $totalAlumnos > 0 ? round((($presentes + $tardanzas) / $totalAlumnos) * 100) : 0; ?>%
            </strong>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 14%;">DNI</th>
                <th>Apellidos y Nombres</th>
                <th style="width: 12%;">Aula</th>
                <th style="width: 12%;">Hora</th>
                <th style="width: 14%;">Estado</th>
                <th style="width: 15%;">Justificación</th>
            </tr>
        </thead>
        <tbody>
            <?php if ($totalAlumnos > 0): ?>
                <?php $i = 1; foreach ($filas as $row): ?>
                    <tr>
                        <td><?php echo $i++; ?></td>
                        <td><?php echo htmlspecialchars($row['dni']); ?></td>
                        <td><strong><?php echo htmlspecialchars($row['nombre']); ?></strong></td>
                        <td><?php echo htmlspecialchars($row['grado'] . '° "' . $row['seccion'] . '"'); ?></td>
                        <td><?php echo !empty($row['hora']) && $row['hora'] !== '00:00:00' ? date('h:i A', strtotime($row['hora'])) : '--:--'; ?></td>
                        <td>
                            <?php if ($row['estado'] === 'Presente'): ?>
                                <span class="badge badge-presente">Presente</span>
                            <?php elseif ($row['estado'] === 'Tarde'): ?>
                                <span class="badge badge-tarde">Tarde</span>
                            <?php else: ?>
                                <span class="badge badge-ausente">Ausente</span>
                            <?php endif; ?>
                        </td>
                        <td><small><?php echo htmlspecialchars($row['justificacion'] ?? '-'); ?></small></td>
                    </tr>
                <?php endforeach; ?>
            <?php else: ?>
                <tr>
                    <td colspan="7" style="text-align: center; padding: 25px; color: #64748b;">
                        No se encontraron registros de estudiantes para los filtros seleccionados.
                    </td>
                </tr>
            <?php endif; ?>
        </tbody>
    </table>

    <div class="firmas">
        <div>
            <div class="linea-firma">Firma del Director(a)</div>
        </div>
        <div>
            <div class="linea-firma">Control de Asistencia / Auxiliar</div>
        </div>
    </div>

</body>
</html>
