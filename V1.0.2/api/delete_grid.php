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

// On peut accepter soit un 'grid_id' soit un 'name' (selon comment vous gérez la suppression)
$gridId   = isset($input['id']) ? intval($input['id']) : null;
$gridName = isset($input['name']) ? trim($input['name']) : null;

if (!$gridId && !$gridName) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Identifiant ou nom de grille manquant.']);
    exit;
}

try {
    $pdo->beginTransaction();

    if ($gridId) {
        // Suppression par ID (recommandé et plus précis)
        $stmt = $pdo->prepare("DELETE FROM grids WHERE id = ? AND user_id = ?");
        $stmt->execute([$gridId, $userId]);
    } else {
        // Suppression par nom si l'ID n'est pas disponible
        $stmt = $pdo->prepare("DELETE FROM grids WHERE name = ? AND user_id = ?");
        $stmt->execute([$gridName, $userId]);
    }

    // Optionnel : Si la grille supprimée était la dernière active dans user_sessions, on peut nettoyer ou laisser tel quel
    $rowCount = $stmt->rowCount();

    $pdo->commit();

    if ($rowCount > 0) {
        echo json_encode(['success' => true, 'message' => 'Grille supprimée avec succès.']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Grille introuvable ou non autorisée.']);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}