<?php
// api/config.php

// 1. Gestion des CORS avec un tableau d'origines autorisées
$allowed_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

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

// 3. Affichage des erreurs pour le débogage
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 4. Démarrage global de la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 5. Connexion à la base de données
$host = 'sql109.infinityfree.com';
$db   = 'if0_42802462_verbicruciste';
$user = 'if0_42802462';
$pass = 'hNnPCNLKzrVW7sh';

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