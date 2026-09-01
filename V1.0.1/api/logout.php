<?php
require_once 'config.php'; // Gère déjà CORS, JSON, Session, Erreurs et $pdo

// api/logout.php
header('Content-Type: application/json');
session_start();
session_unset();
session_destroy();

echo json_encode(['success' => true, 'message' => 'Déconnexion réussie.']);