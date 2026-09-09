<?php
class AuthController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    // POST /api/auth/register
    public function register() {
        $data = json_decode(file_get_contents('php://input'), true);
        $first_name = $data['first_name'] ?? '';
        $last_name = $data['last_name'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($first_name) || empty($last_name) || empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Tous les champs sont requis.']);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Format d\'email invalide.']);
            return;
        }

        // Vérifier si l'email existe déjà
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Cet email est déjà utilisé.']);
            return;
        }

        // Insertion du nouvel utilisateur
        $password_hash = password_hash($password, PASSWORD_BCRYPT);
        $insert = $this->pdo->prepare("INSERT INTO users (first_name, last_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, NOW())");
        
        if ($insert->execute([$first_name, $last_name, $email, $password_hash])) {
            $userId = $this->pdo->lastInsertId();
            $_SESSION['user_id'] = $userId;
            echo json_encode(['success' => true, 'message' => 'Inscription réussie']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur lors de l\'enregistrement en base de données.']);
        }
    }

    // POST /api/auth/login
    public function login() {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Email et mot de passe requis.']);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT id, password_hash FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            
            // Met à jour la date de dernière connexion
            $update = $this->pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
            $update->execute([$user['id']]);

            echo json_encode(['success' => true, 'message' => 'Connexion réussie']);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Identifiants invalides.']);
        }
    }

    // POST /api/auth/logout
    public function logout() {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Déconnexion réussie']);
    }

    // GET /api/auth/check
    public function checkStatus() {
        if (isset($_SESSION['user_id'])) {
            echo json_encode(['success' => true, 'logged_in' => true, 'user_id' => $_SESSION['user_id']]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'logged_in' => false]);
        }
    }
}