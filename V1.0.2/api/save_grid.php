<?php
require_once 'config.php'; // Gère déjà CORS, JSON, Session, Erreurs et $pdo

header('Content-Type: application/json');

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

// Récupération des données (gère le cas où elles sont à la racine ou dans 'content')
$data     = isset($input['content']) ? $input['content'] : $input;

$gridId   = isset($input['id']) ? intval($input['id']) : null;
$name = trim($data['name'] ?? $input['name'] ?? 'Ma Grille');
$cols     = intval($data['cols'] ?? 13);
$rows     = intval($data['rows'] ?? 17);
$version  = intval($data['version'] ?? 2);
$content  = json_encode($data['cells'] ?? []);

try {
    $pdo->beginTransaction();

    // --- VÉRIFICATION DE L'UNICITÉ DU NOM POUR CET UTILISATEUR ---
    $stmtCheck = $pdo->prepare("SELECT id FROM grids WHERE user_id = ? AND name = ?");
    $stmtCheck->execute([$userId, $name]);
    $existingGrid = $stmtCheck->fetch();

    // Si une grille avec ce même nom existe déjà et qu'il ne s'agit pas de la grille en cours de modification
    if ($existingGrid && ($gridId === null || $existingGrid['id'] != $gridId)) {
        throw new Exception("Vous possédez déjà une grille portant le nom '$name'.");
    }
    // -------------------------------------------------------------

    if ($gridId) {
        // Ajout des backticks autour de `rows`
        $stmt = $pdo->prepare("UPDATE grids SET name = ?, cols = ?, `rows` = ?, version = ?, content = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$name, $cols, $rows, $version, $content, $gridId, $userId]);
    } else {
        // Ajout des backticks autour de `rows`
        $stmt = $pdo->prepare("INSERT INTO grids (user_id, name, cols, `rows`, version, content) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $name, $cols, $rows, $version, $content]);
        $gridId = $pdo->lastInsertId();
    }

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
    http_response_code(400); // Code 400 (Bad Request) ou 500 selon l'erreur
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}