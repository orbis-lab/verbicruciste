<?php
class UserController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    private function checkAuth() {
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Non authentifié']);
            exit;
        }
        return $_SESSION['user_id'];
    }

    // GET /api/user
    public function getProfile() {
        $userId = $this->checkAuth();
        $stmt = $this->pdo->prepare("SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        echo json_encode(['success' => true, 'user' => $stmt->fetch(PDO::FETCH_ASSOC)]);
    }

    // GET /api/user/preferences
    public function getPreferences() {
        $userId = $this->checkAuth();
        $stmt = $this->pdo->prepare("SELECT theme FROM user_preferences WHERE user_id = ?");
        $stmt->execute([$userId]);
        $pref = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'preferences' => $pref ?: ['theme' => 'light']]);
    }

    // PUT /api/user/preferences
    public function updatePreferences() {
        $userId = $this->checkAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        $theme = $data['theme'] ?? 'light';

        $stmt = $this->pdo->prepare("INSERT INTO user_preferences (user_id, theme) VALUES (?, ?) ON DUPLICATE KEY UPDATE theme = ?");
        $stmt->execute([$userId, $theme, $theme]);

        echo json_encode(['success' => true, 'message' => 'Préférences mises à jour']);
    }
}