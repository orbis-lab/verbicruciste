<?php
require_once 'config.php'; // Gère CORS, JSON, Session, Erreurs et $pdo

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Utilisateur non authentifié.']);
    exit;
}

$userId = $_SESSION['user_id'];
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de grille manquant ou données invalides.']);
    exit;
}

$gridId = intval($input['id']);
$name   = trim($input['name'] ?? 'Ma Grille');
$cols   = intval($input['cols'] ?? 13);
$rows   = intval($input['rows'] ?? 17);

try {
    $pdo->beginTransaction();

    // On met à jour le nom, les dimensions et la date de modification si tu as une colonne dédiée (sinon on touche juste aux champs nécessaires)
    $stmt = $pdo->prepare("UPDATE grids SET name = ?, cols = ?, `rows` = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$name, $cols, $rows, $gridId, $userId]);

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Paramètres de la grille mis à jour avec succès.']);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}