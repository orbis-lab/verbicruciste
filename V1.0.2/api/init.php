<?php
// Désactiver l'affichage des erreurs HTML dans les réponses
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Charger le fichier de configuration JSON
$configFile = __DIR__ . '/config.json';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Fichier de configuration introuvable.'
    ]);
    exit;
}

$configData = json_decode(file_get_contents($configFile), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Erreur de syntaxe dans le fichier de configuration JSON.'
    ]);
    exit;
}

// 1. Gestion des CORS avec le tableau extrait du JSON
$allowed_origins = $configData['allowed_origins'] ?? [];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
}

// Répondre immédiatement aux requêtes preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Format de réponse par défaut en JSON
header('Content-Type: application/json');

// 3. Affichage des erreurs pour le débogage (si souhaité)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 4. Démarrage global de la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 5. Connexion à la base de données via les variables du JSON
$dbConfig = $configData['db'] ?? [];
$host = $dbConfig['host'] ?? '';
$db   = $dbConfig['name'] ?? '';
$user = $dbConfig['user'] ?? '';
$pass = $dbConfig['pass'] ?? '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Erreur de connexion à la base de données.'
    ]);
    exit;
}