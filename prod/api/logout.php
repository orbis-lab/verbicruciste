<?php
require_once 'init.php'; // Gère déjà CORS, JSON, Session, Erreurs et $pdo

// api/logout.php
// La session est déjà active grâce à config.php, pas besoin de la relancer.

session_unset();
session_destroy();

echo json_encode(['success' => true, 'message' => 'Déconnexion réussie.']);