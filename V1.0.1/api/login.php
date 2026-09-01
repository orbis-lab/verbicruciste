<?php
// api/login.php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Veuillez remplir tous les champs.']);
    exit;
}

$host = 'sql109.infinityfree.com';
$db   = 'if0_42802462_verbicruciste';
$user = 'VOTRE_UTILISATEUR_DB';
$pass = 'VOTRE_MOT_DE_PASSE_DB';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("SELECT id, email, password_hash, is_active FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $userRecord = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$userRecord || !password_verify($password, $userRecord['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'E-mail ou mot de passe incorrect.']);
        exit;
    }

    if (!$userRecord['is_active']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Ce compte a été désactivé.']);
        exit;
    }

    // Mettre à jour la date de dernière connexion
    $updateStmt = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
    $updateStmt->execute([$userRecord['id']]);

    // Ouvrir la session PHP
    session_start();
    $_SESSION['user_id'] = $userRecord['id'];
    $_SESSION['email'] = $userRecord['email'];

    echo json_encode(['success' => true, 'message' => 'Connexion réussie.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la connexion.']);
}