<?php
require_once 'config.php'; // Gère déjà CORS, JSON, Session, Erreurs et $pdo

// api/save_grid.php
header('Content-Type: application/json');

// Session utilisateur (suppose que l'utilisateur est déjà authentifié via $_SESSION['user_id'])
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Utilisateur non authentifié.']);
    exit;
}

$userId = $_SESSION['user_id'];
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Données invalides.']);
    exit;
}

$gridId   = isset($input['id']) ? intval($input['id']) : null;
$name     = trim($input['name'] ?? 'Ma Grille');
$cols     = intval($input['cols'] ?? 13);
$rows     = intval($input['rows'] ?? 17);
$version  = intval($input['version'] ?? 2);
// On encode tout le tableau des cellules en JSON sécurisé pour la colonne longtext
$content  = json_encode($input['cells']);

// Paramètres de connexion à votre base InfinityFree
$host = 'sql109.infinityfree.com';
$db   = 'if0_42802462_verbicruciste';
$user = 'if0_42802462';
$pass = 'hNnPCNLKzrVW7sh';

try {
    

    $pdo->beginTransaction();

    if ($gridId) {
        // Mise à jour d'une grille existante appartenant à l'utilisateur
        $stmt = $pdo->prepare("UPDATE grids SET name = ?, cols = ?, rows = ?, version = ?, content = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$name, $cols, $rows, $version, $content, $gridId, $userId]);
    } else {
        // Création d'une nouvelle grille
        $stmt = $pdo->prepare("INSERT INTO grids (user_id, name, cols, rows, version, content) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $name, $cols, $rows, $version, $content]);
        $gridId = $pdo->lastInsertId();
    }

    // Mise à jour de la table user_sessions (Dernière session active de l'utilisateur)
    $stmtSession = $pdo->prepare("
        INSERT INTO user_sessions (user_id, grid_id, last_opened_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE grid_id = VALUES(grid_id), last_opened_at = NOW()
    ");
    $stmtSession->execute([$userId, $gridId]);

    $pdo->commit();

    echo json_encode(['success' => true, 'grid_id' => $gridId, 'message' => 'Grille enregistrée avec succès dans le cloud.']);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}