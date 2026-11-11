<?php
/**
 * API REST del Sistema de Asistencia Escolar
 * Colegio Ricardo Bentín 64935
 * Versión 2.0 Corregida y Optimizada
 */

require_once 'auth.php';
require_once 'conexion.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Exigir sesión para cualquier acción de la API
verificarSesionAPI();

// -------------------------------------------------------------
// 1. OBTENER LISTA DE ESTUDIANTES Y SUS ASISTENCIAS
// -------------------------------------------------------------
if ($method === 'GET' && $action === 'get_students') {
    $cfgRes = $conn->query("SELECT * FROM configuracion WHERE id = 1");
    $config = $cfgRes ? $cfgRes->fetch_assoc() : [
        'nombre_colegio' => 'Colegio Ricardo Bentín 64935',
        'hora_limite' => '08:00:00',
        'total_dias' => 1
    ];

    $sql = "SELECT e.*, 
            COALESCE(SUM(CASE WHEN a.estado = 'Presente' THEN 1 ELSE 0 END), 0) as presents,
            COALESCE(SUM(CASE WHEN a.estado = 'Tarde' THEN 1 ELSE 0 END), 0) as tardies,
            COALESCE(SUM(CASE WHEN a.estado = 'Ausente' THEN 1 ELSE 0 END), 0) as absences
            FROM estudiantes e
            LEFT JOIN asistencias a ON e.dni = a.estudiante_dni
            GROUP BY e.dni
            ORDER BY 
                CASE e.grado 
                    WHEN '1' THEN 1 WHEN '1°' THEN 1 WHEN 'PRIMERO' THEN 1
                    WHEN '2' THEN 2 WHEN '2°' THEN 2 WHEN 'SEGUNDO' THEN 2
                    WHEN '3' THEN 3 WHEN '3°' THEN 3 WHEN 'TERCERO' THEN 3
                    WHEN '4' THEN 4 WHEN '4°' THEN 4 WHEN 'CUARTO' THEN 4
                    WHEN '5' THEN 5 WHEN '5°' THEN 5 WHEN 'QUINTO' THEN 5
                    ELSE 6 
                END ASC, 
                e.seccion ASC, 
                e.nombre ASC";
                
    $result = $conn->query($sql);

    $stmtLast = $conn->prepare("SELECT fecha, hora FROM asistencias WHERE estudiante_dni = ? AND estado != 'Ausente' ORDER BY fecha DESC, hora DESC LIMIT 1");
    $stmtHistory = $conn->prepare("SELECT fecha as date, hora as time, estado as status, COALESCE(justificacion, '') as justification FROM asistencias WHERE estudiante_dni = ? ORDER BY fecha DESC, hora DESC");

    $students = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $dni = $row['dni'];

            $stmtLast->bind_param("s", $dni);
            $stmtLast->execute();
            $last = $stmtLast->get_result()->fetch_assoc();

            $stmtHistory->bind_param("s", $dni);
            $stmtHistory->execute();
            $histResult = $stmtHistory->get_result();
            $history = [];
            while ($h = $histResult->fetch_assoc()) {
                $history[] = $h;
            }

            $students[] = [
                "dni" => $row['dni'],
                "name" => htmlspecialchars($row['nombre'], ENT_QUOTES, 'UTF-8'),
                "grade" => htmlspecialchars($row['grado'], ENT_QUOTES, 'UTF-8'),
                "section" => htmlspecialchars($row['seccion'], ENT_QUOTES, 'UTF-8'),
                "attendances" => (int)$row['presents'],
                "tardies" => (int)$row['tardies'],
                "absences" => (int)$row['absences'],
                "lastDate" => $last['fecha'] ?? "",
                "lastTime" => $last['hora'] ?? "",
                "foto" => $row['foto'] ?? "",
                "history" => $history
            ];
        }
    }

    echo json_encode(["config" => $config, "students" => $students]);
    exit();
}

// -------------------------------------------------------------
// 2. REGISTRAR ASISTENCIA (QR O MANUAL)
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'register_attendance') {
    $rawInput = file_get_contents("php://input");
    $data = json_decode($rawInput, true);
    $dni = trim($data['dni'] ?? $_POST['dni'] ?? '');
    $today = date("Y-m-d");
    $nowTime = date("H:i:s");

    if (empty($dni)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "DNI requerido."]);
        exit();
    }

    // Verificar si es día hábil
    $stmtEx = $conn->prepare("SELECT tipo FROM calendario_excepciones WHERE fecha = ?");
    $stmtEx->bind_param("s", $today);
    $stmtEx->execute();
    $exRes = $stmtEx->get_result()->fetch_assoc();
    if ($exRes && in_array($exRes['tipo'], ['feriado', 'sin_clases'])) {
        http_response_code(400);
        $tipoTxt = $exRes['tipo'] === 'feriado' ? 'FERIADO' : 'DÍA SIN CLASES';
        echo json_encode(["success" => false, "message" => "Hoy está marcado como $tipoTxt. No hay registro de asistencia."]);
        exit();
    }

    // Verificar si el estudiante existe
    $stmtStudent = $conn->prepare("SELECT * FROM estudiantes WHERE dni = ?");
    $stmtStudent->bind_param("s", $dni);
    $stmtStudent->execute();
    $studentRes = $stmtStudent->get_result();

    if ($studentRes->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "DNI $dni no registrado en el sistema."]);
        exit();
    }
    $student = $studentRes->fetch_assoc();

    // Verificar si ya registró asistencia hoy
    $stmtCheck = $conn->prepare("SELECT id, estado, hora FROM asistencias WHERE estudiante_dni = ? AND fecha = ?");
    $stmtCheck->bind_param("ss", $dni, $today);
    $stmtCheck->execute();
    $checkRes = $stmtCheck->get_result();
    if ($checkRes->num_rows > 0) {
        $existing = $checkRes->fetch_assoc();
        $horaReg = date("h:i A", strtotime($existing['hora']));
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "{$student['nombre']} ya registró ingreso hoy a las $horaReg ({$existing['estado']})."
        ]);
        exit();
    }

    // Comparar con hora límite
    $cfgRes = $conn->query("SELECT hora_limite FROM configuracion WHERE id = 1");
    $limitTime = "08:00:00";
    if ($cfgRes && $rowCfg = $cfgRes->fetch_assoc()) {
        $limitTime = $rowCfg['hora_limite'];
    }
    // Asegurar formato HH:MM:SS
    if (strlen($limitTime) === 5) {
        $limitTime .= ":00";
    }

    $status = ($nowTime > $limitTime) ? 'Tarde' : 'Presente';

    $stmt = $conn->prepare("INSERT INTO asistencias (estudiante_dni, fecha, hora, estado) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $dni, $today, $nowTime, $status);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "status" => $status,
            "name" => htmlspecialchars($student['nombre'], ENT_QUOTES, 'UTF-8'),
            "grade" => $student['grado'],
            "section" => $student['seccion'],
            "time" => date("H:i", strtotime($nowTime)),
            "timeFormatted" => date("h:i A", strtotime($nowTime)),
            "foto" => $student['foto'] ?? ""
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al guardar la asistencia."]);
    }
    exit();
}

// -------------------------------------------------------------
// 3. AÑADIR ESTUDIANTE
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'add_student') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $name = trim($data['name'] ?? '');
    $grade = trim($data['grade'] ?? '');
    $section = trim($data['section'] ?? '');

    if (empty($dni) || empty($name)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "DNI y Nombre son obligatorios."]);
        exit();
    }

    $stmt = $conn->prepare("INSERT INTO estudiantes (dni, nombre, grado, seccion) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $dni, $name, $grade, $section);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Estudiante registrado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al registrar: el DNI ya existe o los datos son inválidos."]);
    }
    exit();
}

// -------------------------------------------------------------
// 4. EDITAR ESTUDIANTE
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'edit_student') {
    $data = json_decode(file_get_contents("php://input"), true);
    $originalDni = trim($data['originalDni'] ?? '');
    $dni = trim($data['dni'] ?? '');
    $name = trim($data['name'] ?? '');
    $grade = trim($data['grade'] ?? '');
    $section = trim($data['section'] ?? '');

    $stmt = $conn->prepare("UPDATE estudiantes SET dni = ?, nombre = ?, grado = ?, seccion = ? WHERE dni = ?");
    $stmt->bind_param("sssss", $dni, $name, $grade, $section, $originalDni);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Estudiante actualizado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar estudiante."]);
    }
    exit();
}

// -------------------------------------------------------------
// 5. SUBIR O ACTUALIZAR FOTO DE ESTUDIANTE (¡CORREGIDO!)
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'upload_student_foto') {
    $rawInput = file_get_contents("php://input");
    $data = json_decode($rawInput, true);

    $dni = trim($data['dni'] ?? $_POST['dni'] ?? '');
    $fotoData = trim($data['foto'] ?? '');

    if (empty($dni)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "DNI es obligatorio."]);
        exit();
    }

    // Si viene por archivo subido (multipart)
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $fileTmp = $_FILES['foto']['tmp_name'];
        $ext = pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION);
        $nombreArchivo = "estudiante_" . $dni . "_" . time() . "." . $ext;
        $rutaDestino = "uploads/" . $nombreArchivo;
        if (!is_dir('uploads')) { mkdir('uploads', 0755, true); }
        if (move_uploaded_file($fileTmp, $rutaDestino)) {
            $fotoData = $rutaDestino;
        }
    }

    $stmt = $conn->prepare("UPDATE estudiantes SET foto = ? WHERE dni = ?");
    $stmt->bind_param("ss", $fotoData, $dni);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Foto del estudiante guardada en la base de datos.", "foto" => $fotoData]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al guardar foto en la base de datos."]);
    }
    exit();
}

// -------------------------------------------------------------
// 6. ELIMINAR ESTUDIANTE
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'delete_student') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $stmt = $conn->prepare("DELETE FROM estudiantes WHERE dni = ?");
    $stmt->bind_param("s", $dni);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Estudiante eliminado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar estudiante."]);
    }
    exit();
}

// -------------------------------------------------------------
// 7. INICIAR NUEVO DÍA LECTIVO
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'next_day') {
    $conn->query("UPDATE configuracion SET total_dias = total_dias + 1 WHERE id = 1");
    echo json_encode(["success" => true, "message" => "Nuevo día lectivo iniciado."]);
    exit();
}

// -------------------------------------------------------------
// 8. MARCAR RESTANTES COMO AUSENTES
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'mark_absents') {
    $today = date("Y-m-d");
    $diaSemana = (int)date("N", strtotime($today)); // 6 = Sábado, 7 = Domingo

    if ($diaSemana >= 6) {
        echo json_encode(["success" => true, "count" => 0, "message" => "Hoy es fin de semana. No se marcaron ausencias."]);
        exit();
    }

    $stmtEx = $conn->prepare("SELECT tipo FROM calendario_excepciones WHERE fecha = ?");
    $stmtEx->bind_param("s", $today);
    $stmtEx->execute();
    $exRes = $stmtEx->get_result()->fetch_assoc();
    if ($exRes && in_array($exRes['tipo'], ['feriado', 'sin_clases'])) {
        echo json_encode(["success" => true, "count" => 0, "message" => "Día registrado como feriado o sin clases."]);
        exit();
    }

    $sql = "INSERT IGNORE INTO asistencias (estudiante_dni, fecha, hora, estado)
            SELECT dni, ?, '00:00:00', 'Ausente'
            FROM estudiantes
            WHERE dni NOT IN (SELECT estudiante_dni FROM asistencias WHERE fecha = ?)";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $today, $today);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "count" => $stmt->affected_rows]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al registrar ausencias."]);
    }
    exit();
}

// -------------------------------------------------------------
// 9. GUARDAR CONFIGURACIÓN INSTITUCIONAL
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'save_config') {
    $data = json_decode(file_get_contents("php://input"), true);
    $schoolName = trim($data['schoolName'] ?? '');
    $limitTime = trim($data['limitTime'] ?? '');

    if (empty($schoolName)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Nombre del colegio requerido."]);
        exit();
    }

    $stmt = $conn->prepare("UPDATE configuracion SET nombre_colegio = ?, hora_limite = ? WHERE id = 1");
    $stmt->bind_param("ss", $schoolName, $limitTime);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Configuración guardada correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al guardar configuración."]);
    }
    exit();
}

// -------------------------------------------------------------
// 10. OBTENER LISTA DE PROFESORES
// -------------------------------------------------------------
if ($method === 'GET' && $action === 'get_profesores') {
    $result = $conn->query("SELECT * FROM profesores ORDER BY nombre_completo ASC");
    $profesores = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $profesores[] = $row;
        }
    }
    echo json_encode(["profesores" => $profesores]);
    exit();
}

// -------------------------------------------------------------
// 11. REGISTRAR PROFESOR CON FOTO
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'add_profesor_foto') {
    $dni = trim($_POST['dni'] ?? '');
    $nombre = trim($_POST['nombre'] ?? '');
    $especialidad = trim($_POST['especialidad'] ?? '');
    
    $fotoRuta = "";
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $fileTmp = $_FILES['foto']['tmp_name'];
        $fileMime = mime_content_type($fileTmp);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

        if (in_array($fileMime, $allowedMimes)) {
            $ext = pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION);
            $nombreArchivo = "docente_" . bin2hex(random_bytes(6)) . "_" . time() . "." . $ext;
            $rutaDestino = "uploads/" . $nombreArchivo;
            if (!is_dir('uploads')) { mkdir('uploads', 0755, true); }
            if (move_uploaded_file($fileTmp, $rutaDestino)) {
                $fotoRuta = $rutaDestino;
            }
        }
    }

    $stmt = $conn->prepare("INSERT INTO profesores (dni, nombre_completo, especialidad, foto) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $dni, $nombre, $especialidad, $fotoRuta);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Profesor registrado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al guardar profesor (DNI posiblemente duplicado)."]);
    }
    exit();
}

// -------------------------------------------------------------
// 12. EDITAR PROFESOR (¡ACCIÓN CORREGIDA QUE FALTABA!)
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'edit_profesor') {
    $originalDni = trim($_POST['original_dni'] ?? $_POST['dni'] ?? '');
    $dni = trim($_POST['dni'] ?? '');
    $nombre = trim($_POST['nombre'] ?? '');
    $especialidad = trim($_POST['especialidad'] ?? '');

    if (empty($originalDni) || empty($nombre)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Datos incompletos para actualizar profesor."]);
        exit();
    }

    $fotoRuta = null;
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $fileTmp = $_FILES['foto']['tmp_name'];
        $ext = pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION);
        $nombreArchivo = "docente_" . bin2hex(random_bytes(6)) . "_" . time() . "." . $ext;
        $rutaDestino = "uploads/" . $nombreArchivo;
        if (!is_dir('uploads')) { mkdir('uploads', 0755, true); }
        if (move_uploaded_file($fileTmp, $rutaDestino)) {
            $fotoRuta = $rutaDestino;
        }
    }

    if ($fotoRuta !== null) {
        $stmt = $conn->prepare("UPDATE profesores SET dni = ?, nombre_completo = ?, especialidad = ?, foto = ? WHERE dni = ?");
        $stmt->bind_param("sssss", $dni, $nombre, $especialidad, $fotoRuta, $originalDni);
    } else {
        $stmt = $conn->prepare("UPDATE profesores SET dni = ?, nombre_completo = ?, especialidad = ? WHERE dni = ?");
        $stmt->bind_param("ssss", $dni, $nombre, $especialidad, $originalDni);
    }

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Profesor actualizado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar los datos del profesor."]);
    }
    exit();
}

// -------------------------------------------------------------
// 13. ELIMINAR PROFESOR
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'delete_profesor') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $stmt = $conn->prepare("DELETE FROM profesores WHERE dni = ?");
    $stmt->bind_param("s", $dni);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Profesor eliminado correctamente."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar profesor."]);
    }
    exit();
}

// -------------------------------------------------------------
// 14. JUSTIFICAR ASISTENCIA / TARDANZA
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'justificar_asistencia') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $fecha = trim($data['fecha'] ?? '');
    $motivo = trim($data['motivo'] ?? '');

    $stmt = $conn->prepare("UPDATE asistencias SET justificacion = ? WHERE estudiante_dni = ? AND fecha = ?");
    $stmt->bind_param("sss", $motivo, $dni, $fecha);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Justificación guardada con éxito."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al registrar justificación."]);
    }
    exit();
}

// -------------------------------------------------------------
// 15. EDITAR REGISTRO ESPECÍFICO DE ASISTENCIA
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'edit_attendance_record') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $fecha = trim($data['fecha'] ?? '');
    $status = trim($data['status'] ?? '');

    $stmt = $conn->prepare("UPDATE asistencias SET estado = ? WHERE estudiante_dni = ? AND fecha = ?");
    $stmt->bind_param("sss", $status, $dni, $fecha);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Estado de asistencia modificado."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar registro de asistencia."]);
    }
    exit();
}

// -------------------------------------------------------------
// 16. ELIMINAR REGISTRO ESPECÍFICO DE ASISTENCIA
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'delete_attendance_record') {
    $data = json_decode(file_get_contents("php://input"), true);
    $dni = trim($data['dni'] ?? '');
    $fecha = trim($data['fecha'] ?? '');

    $stmt = $conn->prepare("DELETE FROM asistencias WHERE estudiante_dni = ? AND fecha = ?");
    $stmt->bind_param("ss", $dni, $fecha);
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Registro eliminado."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar registro."]);
    }
    exit();
}

// -------------------------------------------------------------
// 17. ACTUALIZAR TOTAL DÍAS ACUMULADOS
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'update_total_dias') {
    $data = json_decode(file_get_contents("php://input"), true);
    $total = intval($data['total'] ?? 1);
    $stmt = $conn->prepare("UPDATE configuracion SET total_dias = ? WHERE id = 1");
    $stmt->bind_param("i", $total);
    if ($stmt->execute()) {
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar total de días."]);
    }
    exit();
}

// -------------------------------------------------------------
// 18. GUARDAR DÍA DEL CALENDARIO (Feriado, Sin Clases, Normal)
// -------------------------------------------------------------
if ($method === 'POST' && $action === 'save_calendar_day') {
    $data = json_decode(file_get_contents("php://input"), true);
    $fecha = trim($data['fecha'] ?? '');
    $tipo = trim($data['tipo'] ?? '');

    if ($tipo === 'normal' || empty($tipo)) {
        $stmt = $conn->prepare("DELETE FROM calendario_excepciones WHERE fecha = ?");
        $stmt->bind_param("s", $fecha);
        $stmt->execute();
        echo json_encode(["success" => true, "message" => "Día marcado como lectivo normal."]);
    } else {
        $stmt = $conn->prepare("INSERT INTO calendario_excepciones (fecha, tipo) VALUES (?, ?) ON DUPLICATE KEY UPDATE tipo = ?");
        $stmt->bind_param("sss", $fecha, $tipo, $tipo);
        $stmt->execute();
        echo json_encode(["success" => true, "message" => "Día marcado como " . strtoupper($tipo) . "."]);
    }
    exit();
}

// -------------------------------------------------------------
// 19. RESUMEN DE FECHA (CALENDARIO)
// -------------------------------------------------------------
if ($method === 'GET' && $action === 'get_date_summary') {
    $fecha = trim($_GET['fecha'] ?? date('Y-m-d'));

    $stmtCal = $conn->prepare("SELECT tipo FROM calendario_excepciones WHERE fecha = ?");
    $stmtCal->bind_param("s", $fecha);
    $stmtCal->execute();
    $calRes = $stmtCal->get_result()->fetch_assoc();
    $tipoDia = $calRes['tipo'] ?? 'normal';

    $stmt = $conn->prepare("SELECT 
        COALESCE(SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END), 0) as presentes,
        COALESCE(SUM(CASE WHEN estado = 'Tarde' THEN 1 ELSE 0 END), 0) as tardanzas,
        COALESCE(SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END), 0) as ausentes,
        COALESCE(SUM(CASE WHEN justificacion IS NOT NULL AND justificacion != '' THEN 1 ELSE 0 END), 0) as justificados
        FROM asistencias WHERE fecha = ?");
    $stmt->bind_param("s", $fecha);
    $stmt->execute();
    $stats = $stmt->get_result()->fetch_assoc();

    $totalAlumnosRow = $conn->query("SELECT COUNT(*) as total FROM estudiantes");
    $totalAlumnos = $totalAlumnosRow ? $totalAlumnosRow->fetch_assoc()['total'] : 0;

    $stmtEstudiantesFecha = $conn->prepare("
        SELECT e.dni, e.nombre, e.grado, e.seccion, a.estado, a.hora, a.justificacion
        FROM estudiantes e 
        LEFT JOIN asistencias a ON e.dni = a.estudiante_dni AND a.fecha = ?
        ORDER BY e.grado ASC, e.seccion ASC, e.nombre ASC
    ");
    $stmtEstudiantesFecha->bind_param("s", $fecha);
    $stmtEstudiantesFecha->execute();
    $resEstFecha = $stmtEstudiantesFecha->get_result();
    
    $estudiantesFecha = [];
    if ($resEstFecha) {
        while ($rowEst = $resEstFecha->fetch_assoc()) {
            $estudiantesFecha[] = [
                'dni' => $rowEst['dni'],
                'name' => htmlspecialchars($rowEst['nombre'], ENT_QUOTES, 'UTF-8'),
                'grade' => $rowEst['grado'],
                'section' => $rowEst['seccion'],
                'status' => $rowEst['estado'] ? $rowEst['estado'] : 'Ausente',
                'time' => $rowEst['hora'] && $rowEst['hora'] !== '00:00:00' ? date("H:i", strtotime($rowEst['hora'])) : '--:--',
                'justification' => $rowEst['justificacion'] ?? ''
            ];
        }
    }

    echo json_encode([
        "success" => true,
        "tipo_dia" => $tipoDia,
        "presentes" => intval($stats['presentes'] ?? 0),
        "tardanzas" => intval($stats['tardanzas'] ?? 0),
        "ausentes" => intval($stats['ausentes'] ?? 0),
        "justificados" => intval($stats['justificados'] ?? 0),
        "total_estudiantes" => intval($totalAlumnos),
        "estudiantes_fecha" => $estudiantesFecha
    ]);
    exit();
}

// Acción no reconocida
http_response_code(404);
echo json_encode(["success" => false, "message" => "Acción no reconocida."]);
?>
