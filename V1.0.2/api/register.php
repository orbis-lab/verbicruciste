<?php
// api/register.php
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);

$email     = trim($input['email'] ?? '');
$password  = $input['password'] ?? '';
$firstName = trim($input['first_name'] ?? '');
$lastName  = trim($input['last_name'] ?? '');

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'L\'e-mail et le mot de passe sont obligatoires.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Format d\'e-mail invalide.']);
    exit;
}

try {
    // Vérifier si l'e-mail existe déjà
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $checkStmt->execute([$email]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Cet e-mail est déjà utilisé.']);
        exit;
    }

    $pdo->beginTransaction();

    // Hachage sécurisé du mot de passe
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Insertion de l'utilisateur
    $stmt = $pdo->prepare("INSERT INTO users (email, password_hash, first_name, last_name, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([$email, $passwordHash, $firstName, $lastName]);
    $userId = $pdo->lastInsertId();

    // 1. Insertion dans user_preferences (au pluriel)
    $prefStmt = $pdo->prepare("INSERT INTO user_preferences (user_id, theme) VALUES (?, 'light')");
    $prefStmt->execute([$userId]);

    // 2. Insertion dans user_session
    $sessionStmt = $pdo->prepare("INSERT INTO user_sessions (user_id, grid_id, last_opened_at) VALUES (?, NULL, NOW())");
    $sessionStmt->execute([$userId]);

    $pdo->commit();

    $_SESSION['user_id'] = $userId;
    $_SESSION['email'] = $email;

    echo json_encode(['success' => true, 'message' => 'Compte créé avec succès.']);

} catch (Throwable $e) { // <-- Throwable capture TOUTES les erreurs (exceptions + erreurs fatales PHP)
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    // Renvoie le message d'erreur précis, le fichier et la ligne exacte dans le JSON
    echo json_encode([
        'success' => false, 
        'error' => 'Erreur : ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}