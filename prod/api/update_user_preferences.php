<?php
require_once 'init.php'; // Gère CORS, JSON, Session, Erreurs et $pdo

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Utilisateur non authentifié']);
    exit;
}

$userId = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);
$newTheme = $data['theme'] ?? null;

if (!in_array($newTheme, ['light', 'dark'])) {
    echo json_encode(['success' => false, 'error' => 'Thème invalide']);
    exit;
}

try {
   
    // Requête UPSERT (insertion ou mise à jour selon si l'enregistrement existe)
    $stmt = $pdo->prepare("
        INSERT INTO user_preferences (user_id, theme) VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE theme = ?
    ");
    $stmt->execute([$userId, $newTheme, $newTheme]);

    echo json_encode(['success' => true, 'theme' => $newTheme]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}