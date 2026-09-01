<?php
// api/register.php
header('Content-Type: application/json');

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

// Paramètres de connexion (à adapter avec vos identifiants InfinityFree)
$host = 'sql109.infinityfree.com';
$db   = 'if0_42802462_verbicruciste';
$user = 'VOTRE_UTILISATEUR_DB';
$pass = 'VOTRE_MOT_DE_PASSE_DB';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

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

    // Création des préférences par défaut pour ce nouvel utilisateur
    $prefStmt = $pdo->prepare("INSERT INTO user_preferences (user_id, theme) VALUES (?, 'light')");
    $prefStmt->execute([$userId]);

    $pdo->commit();

    // Démarrage de la session PHP pour connecter l'utilisateur immédiatement après son inscription
    session_start();
    $_SESSION['user_id'] = $userId;
    $_SESSION['email'] = $email;

    echo json_encode(['success' => true, 'message' => 'Compte créé avec succès.']);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la création du compte.']);
}