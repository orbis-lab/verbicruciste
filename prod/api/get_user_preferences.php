<?php
// ------------------------------------------------

header('Content-Type: application/json');
require_once 'init.php'; // Gère $pdo et la session

try {
    // Vérifier si l'utilisateur est connecté via la session
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Utilisateur non authentifié']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Interroger la table user_preferences (au pluriel)
    $stmt = $pdo->prepare("SELECT theme FROM user_preferences WHERE user_id = ?");
    $stmt->execute([$userId]);
    $preference = $stmt->fetch(PDO::FETCH_ASSOC);

    // Si aucune préférence trouvée, on met 'light' par défaut
    $theme = $preference ? $preference['theme'] : 'light';

    echo json_encode(['success' => true, 'theme' => $theme]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Erreur : ' . $e->getMessage()
    ]);
}