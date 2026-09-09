<?php
require_once __DIR__ . '/init.php';

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Supprime proprement le chemin du dossier d'API (gère à la fois /V1.0.3/api/ et /api/)
$basePath = preg_replace('#^.*\/api\/?#', '', $requestUri);

$segments = explode('/', trim($basePath, '/'));

$method = $_SERVER['REQUEST_METHOD'];
$resource = $segments[0] ?? '';
$actionOrId = $segments[1] ?? null;
$subAction = $segments[2] ?? null;

switch ($resource) {
    case 'grids':
        require_once __DIR__ . '/controllers/GridController.php';
        $controller = new GridController($pdo);
        if ($method === 'GET' && !$actionOrId) $controller->getAll();
        elseif ($method === 'GET' && $actionOrId) $controller->getOne($actionOrId);
        elseif ($method === 'POST') $controller->create();
        elseif ($method === 'PUT' && $actionOrId) $controller->update($actionOrId);
        elseif ($method === 'DELETE' && $actionOrId) $controller->delete($actionOrId);
        else { http_response_code(405); echo json_encode(['error' => 'Méthode non autorisée']); }
        break;

    case 'user':
        require_once __DIR__ . '/controllers/UserController.php';
        $controller = new UserController($pdo);
        if ($method === 'GET' && !$actionOrId) $controller->getProfile();
        elseif ($method === 'GET' && $actionOrId === 'preferences') $controller->getPreferences();
        elseif ($method === 'PUT' && $actionOrId === 'preferences') $controller->updatePreferences();
        else { http_response_code(404); echo json_encode(['error' => 'Route introuvable']); }
        break;

    case 'auth':
        require_once __DIR__ . '/controllers/AuthController.php';
        $controller = new AuthController($pdo);
        if ($actionOrId === 'login' && $method === 'POST') $controller->login();
        elseif ($actionOrId === 'register' && $method === 'POST') $controller->register();
        elseif ($actionOrId === 'logout' && $method === 'POST') $controller->logout();
        else { http_response_code(404); echo json_encode(['error' => 'Route introuvable']); }
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Ressource introuvable']);
        break;
}