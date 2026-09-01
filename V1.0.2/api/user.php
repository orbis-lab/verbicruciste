<?php
require_once 'config.php'; // Gère CORS, JSON, Session, Erreurs et $pdo

header('Content-Type: application/json');

// 1. Vérifier si l'ID utilisateur est présent dans la session
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Non connecté"]);
    exit;
}

try {

    // 3. Interroger la table users pour récupérer la ligne correspondant à l'ID
    $stmt = $pdo->prepare("SELECT id, first_name, last_name, email, created_at FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        // Cas rare : la session existe mais l'utilisateur a été supprimé de la BBD
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "Utilisateur introuvable"]);
        exit;
    }

    // 4. Renvoyer les données sécurisées (le mot de passe haché n'est évidemment pas sélectionné dans la requête)
    echo json_encode([
        "success" => true,
        "user" => $user
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Erreur serveur"]);
}
exit;