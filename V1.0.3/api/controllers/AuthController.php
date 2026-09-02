<?php
class AuthController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
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

    // GET /api/auth/check (Optionnel mais pratique pour le front)
    public function checkStatus() {
        if (isset($_SESSION['user_id'])) {
            echo json_encode(['success' => true, 'logged_in' => true, 'user_id' => $_SESSION['user_id']]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'logged_in' => false]);
        }
    }
}