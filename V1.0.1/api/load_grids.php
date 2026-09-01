<?php
// api/load_grids.php
require_once 'config.php'; // Gère déjà CORS, JSON, Session, Erreurs et $pdo

// Vérifier si l'utilisateur est connecté via la session
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false, 
        'error' => 'Utilisateur non authentifié.'
    ]);
    exit;
}

$userId = $_SESSION['user_id'];

// api/load_grids.php
try {
    // MODIFICATION ICI : On sélectionne aussi cols et rows
    $stmt = $pdo->prepare("SELECT id, name, cols, `rows`, content, updated_at FROM grids WHERE user_id = ? ORDER BY updated_at DESC");
    $stmt->execute([$userId]);
    $grids = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'grids' => $grids
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}