<?php
/**
 * MOD Tracker - Backend API (MySQL Persistent - Multi-user Independent Tracking)
 */

error_reporting(0);
ini_set('display_errors', 0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración desde variables de entorno (fallback a valores por defecto)
$host    = getenv('DB_HOST')    ?: '91.242.131.16';
$port    = getenv('DB_PORT')    ?: '3306';
$db      = getenv('DB_NAME')    ?: 'mod_tracker_db';
$user    = getenv('DB_USER')    ?: 'mod_user';
$pass    = getenv('DB_PASS')    ?: '^k256Ops7';
$charset = getenv('DB_CHARSET') ?: 'utf8mb4';

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    echo json_encode(["error" => "DB_CONNECTION_FAILED", "details" => $e->getMessage()]);
    exit;
}

try {
    // 1. Tabla de Usuarios
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(20),
        avatar_seed VARCHAR(100),
        last_login DATETIME,
        project_order TEXT,
        can_modify_logs TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB;");
    try { $pdo->exec("ALTER TABLE users ADD COLUMN can_modify_logs TINYINT(1) DEFAULT 1"); } catch (Exception $e) {}

    // 2. Tabla de Proyectos (Metadatos Globales)
    $pdo->exec("CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY, 
        creator_id VARCHAR(50), 
        name VARCHAR(255), 
        category VARCHAR(255), 
        color VARCHAR(50), 
        is_global TINYINT(1) DEFAULT 0, 
        is_active TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB;");

    // Asegurar columnas para compatibilidad con versiones previas
    try { $pdo->exec("ALTER TABLE projects ADD COLUMN creator_id VARCHAR(50) AFTER id"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE projects ADD COLUMN is_global TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE projects ADD COLUMN is_active TINYINT(1) DEFAULT 1"); } catch (Exception $e) {}

    // 3. NUEVA Tabla de Rastreo Individual por Usuario
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_projects (
        user_id VARCHAR(50),
        project_id VARCHAR(50),
        running_since VARCHAR(50) NULL, 
        current_day_seconds INT DEFAULT 0,
        session_comment VARCHAR(500) NULL,
        hidden_by_user TINYINT(1) DEFAULT 0,
        PRIMARY KEY (user_id, project_id)
    ) ENGINE=InnoDB;");
    try { $pdo->exec("ALTER TABLE user_projects ADD COLUMN session_comment VARCHAR(500) NULL AFTER current_day_seconds"); } catch (Exception $e) {}

    // 4. Tabla de Logs Históricos
    $pdo->exec("CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(50) PRIMARY KEY, 
        user_id VARCHAR(50), 
        project_id VARCHAR(50), 
        project_name VARCHAR(255), 
        date_str VARCHAR(50), 
        duration_seconds INT, 
        status VARCHAR(50), 
        comment TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    try { $pdo->exec("ALTER TABLE logs ADD COLUMN comment TEXT NULL AFTER status"); } catch (Exception $e) {}

    // 5. Historial de modificaciones de logs (para que Admin vea ediciones)
    $pdo->exec("CREATE TABLE IF NOT EXISTS log_modification_history (
        id VARCHAR(50) PRIMARY KEY,
        log_id VARCHAR(50) NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_by_user_id VARCHAR(50) NOT NULL,
        old_duration_seconds INT NOT NULL,
        new_duration_seconds INT NOT NULL,
        old_date_str VARCHAR(50) NOT NULL,
        new_date_str VARCHAR(50) NOT NULL,
        old_comment TEXT NULL,
        new_comment TEXT NULL,
        INDEX idx_log_id (log_id)
    ) ENGINE=InnoDB;");

    // Usuario Admin por defecto
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = 'Admin'");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $pdo->prepare("INSERT INTO users (id, username, password, role, avatar_seed, last_login, project_order) VALUES (?,?,?,?,?,?,?)")
            ->execute(['admin-001', 'Admin', '123456789', 'ADMIN', 'admin-default', date('Y-m-d H:i:s'), '[]']);
    }
} catch (Exception $e) {}

// Comprueba si $modifierId puede modificar/borrar $logId.
// Permite a ADMIN siempre. Permite al dueño solo si users.can_modify_logs = 1.
function canUserModifyLog(PDO $pdo, string $logId, ?string $modifierId): bool {
    if (!$modifierId) return false;
    $u = $pdo->prepare("SELECT role, can_modify_logs FROM users WHERE id = ?");
    $u->execute([$modifierId]);
    $userRow = $u->fetch(PDO::FETCH_ASSOC);
    if (!$userRow) return false;
    if (($userRow['role'] ?? '') === 'ADMIN') return true;
    $l = $pdo->prepare("SELECT user_id FROM logs WHERE id = ?");
    $l->execute([$logId]);
    $logRow = $l->fetch(PDO::FETCH_ASSOC);
    if (!$logRow) return false;
    if ($logRow['user_id'] !== $modifierId) return false;
    return (int)($userRow['can_modify_logs'] ?? 1) === 1;
}

$action = $_GET['action'] ?? 'status';

switch($action) {
    case 'status':
        echo json_encode(["status" => "online", "db" => "ok", "server_time" => date('c')]);
        break;

    case 'get_users':
        echo json_encode($pdo->query("SELECT * FROM users")->fetchAll());
        break;
    
    case 'save_user':
        $data = json_decode(file_get_contents('php://input'), true);
        $canModify = isset($data['canModifyLogs']) ? ($data['canModifyLogs'] ? 1 : 0) : 1;
        $stmt = $pdo->prepare("INSERT INTO users (id, username, password, role, avatar_seed, last_login, project_order, can_modify_logs) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role=VALUES(role), last_login=VALUES(last_login), project_order=VALUES(project_order), can_modify_logs=VALUES(can_modify_logs)");
        $stmt->execute([$data['id'], $data['username'], $data['password'], $data['role'], $data['avatarSeed'], $data['lastLogin'], json_encode($data['projectOrder'] ?? []), $canModify]);
        echo json_encode(["status" => "ok"]);
        break;

    case 'get_projects':
        $requestUserId = $_GET['userId'] ?? 'none';
        // Terminal: todos los usuarios ven todos los proyectos activos; el estado (cronómetro, oculto) es por usuario vía user_projects
        $stmt = $pdo->prepare("
            SELECT 
                p.*, 
                up.running_since, 
                up.current_day_seconds,
                up.session_comment,
                up.hidden_by_user
            FROM projects p
            LEFT JOIN user_projects up ON p.id = up.project_id AND up.user_id = ?
            WHERE p.is_active = 1
            ORDER BY p.name
        ");
        $stmt->execute([$requestUserId]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'save_project':
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = $data['userId'] ?? null;
        
        $pdo->beginTransaction();
        
        // Solo actualizar campos de projects si están presentes y no son NULL/vacíos
        // Esto previene sobrescribir datos existentes con NULL
        if (isset($data['name']) && $data['name'] !== null && $data['name'] !== '' && $data['name'] !== 'null') {
            // Si tenemos name, también necesitamos los otros campos básicos
            $stmtP = $pdo->prepare("INSERT INTO projects (id, creator_id, name, category, color, is_global, is_active) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), color=VALUES(color), is_global=VALUES(is_global), is_active=VALUES(is_active)");
            $stmtP->execute([
                $data['id'], 
                $data['creatorId'] ?? $userId, 
                $data['name'], 
                $data['category'] ?? 'General', 
                $data['color'] ?? 'vibrant-blue', 
                isset($data['isGlobal']) ? ($data['isGlobal'] ? 1 : 0) : 0, 
                isset($data['isActive']) ? (($data['isActive'] === false) ? 0 : 1) : 1
            ]);
        } else {
            // Si no hay name, solo asegurar que el proyecto existe (no actualizar campos)
            $stmtP = $pdo->prepare("INSERT IGNORE INTO projects (id, creator_id, name, category, color, is_global, is_active) VALUES (?,?,?,?,?,?,?)");
            $stmtP->execute([
                $data['id'], 
                $data['creatorId'] ?? $userId, 
                'Temporal', 
                'General', 
                'vibrant-blue', 
                0, 
                1
            ]);
        }

        if ($userId) {
            // running_since=VALUES(running_since) para que null pare el cronómetro (reset/pausa)
            $stmtUP = $pdo->prepare("INSERT INTO user_projects (user_id, project_id, running_since, current_day_seconds, session_comment, hidden_by_user) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE running_since=VALUES(running_since), current_day_seconds=VALUES(current_day_seconds), session_comment=COALESCE(VALUES(session_comment), session_comment), hidden_by_user=VALUES(hidden_by_user)");
            $stmtUP->execute([
                $userId,
                $data['id'],
                $data['runningSince'] ?? null,
                $data['currentDaySeconds'] ?? 0,
                $data['sessionComment'] ?? null,
                isset($data['isHiddenForUser']) ? ($data['isHiddenForUser'] ? 1 : 0) : 0
            ]);
        }
        
        $pdo->commit();
        echo json_encode(["status" => "ok"]);
        break;

    case 'update_log':
        $data = json_decode(file_get_contents('php://input'), true);
        $logId = $data['id'] ?? '';
        $newDuration = (int)($data['durationSeconds'] ?? 0);
        $newDate = $data['date'] ?? '';
        $newComment = $data['comment'] ?? null;
        $modifiedByUserId = $data['modifiedByUserId'] ?? null;
        if (!$logId) { echo json_encode(["error" => "ID_REQUIRED"]); break; }
        if (!canUserModifyLog($pdo, $logId, $modifiedByUserId)) {
            http_response_code(403);
            echo json_encode(["error" => "FORBIDDEN", "details" => "El usuario no tiene permiso para modificar este registro."]);
            break;
        }
        $current = $pdo->prepare("SELECT duration_seconds, date_str, comment FROM logs WHERE id = ?");
        $current->execute([$logId]);
        $row = $current->fetch(PDO::FETCH_ASSOC);
        if ($row && $modifiedByUserId) {
            $histId = 'HIST-' . $logId . '-' . time();
            $ins = $pdo->prepare("INSERT INTO log_modification_history (id, log_id, modified_by_user_id, old_duration_seconds, new_duration_seconds, old_date_str, new_date_str, old_comment, new_comment) VALUES (?,?,?,?,?,?,?,?,?)");
            $ins->execute([$histId, $logId, $modifiedByUserId, (int)$row['duration_seconds'], $newDuration, $row['date_str'], $newDate, $row['comment'], $newComment]);
        }
        $stmt = $pdo->prepare("UPDATE logs SET duration_seconds = ?, date_str = ?, comment = ? WHERE id = ?");
        $stmt->execute([$newDuration, $newDate, $newComment, $logId]);
        echo json_encode(["status" => "ok"]);
        break;

    case 'delete_project':
        $id = $_GET['id'] ?? '';
        if ($id) {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM logs WHERE project_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM user_projects WHERE project_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM projects WHERE id = ?")->execute([$id]);
            $pdo->commit();
            echo json_encode(["status" => "ok"]);
        } else {
            echo json_encode(["error" => "ID_REQUIRED"]);
        }
        break;

    case 'get_logs':
        $userId = $_GET['userId'] ?? null;
        if ($userId) {
            $stmt = $pdo->prepare("SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC");
            $stmt->execute([$userId]);
            echo json_encode($stmt->fetchAll());
        } else {
            echo json_encode($pdo->query("SELECT * FROM logs ORDER BY created_at DESC")->fetchAll());
        }
        break;

    case 'save_log':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("INSERT INTO logs (id, user_id, project_id, project_name, date_str, duration_seconds, status, comment) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([$data['id'], $data['userId'], $data['projectId'], $data['projectName'], $data['date'], $data['durationSeconds'], $data['status'], $data['comment'] ?? null]);
        echo json_encode(["status" => "ok"]);
        break;

    case 'delete_log':
        $id = $_GET['id'] ?? '';
        $modifiedByUserId = $_GET['modifiedByUserId'] ?? null;
        if (!$id) { echo json_encode(["error" => "ID_REQUIRED"]); break; }
        if (!canUserModifyLog($pdo, $id, $modifiedByUserId)) {
            http_response_code(403);
            echo json_encode(["error" => "FORBIDDEN", "details" => "El usuario no tiene permiso para borrar este registro."]);
            break;
        }
        $stmt = $pdo->prepare("DELETE FROM logs WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["status" => "ok"]);
        break;

    case 'get_log_modification_history':
        $logId = $_GET['logId'] ?? '';
        if (!$logId) { echo json_encode([]); break; }
        $stmt = $pdo->prepare("SELECT id, log_id, modified_at, modified_by_user_id, old_duration_seconds, new_duration_seconds, old_date_str, new_date_str, old_comment, new_comment FROM log_modification_history WHERE log_id = ? ORDER BY modified_at DESC");
        $stmt->execute([$logId]);
        echo json_encode($stmt->fetchAll());
        break;

    default:
        http_response_code(404);
        echo json_encode(["error" => "Acción no válida"]);
        break;
}
?>