<?php
class GridController {
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

    // GET /api/grids
    public function getAll() {
        $userId = $this->checkAuth();
        $stmt = $this->pdo->prepare("SELECT id, name, cols, `rows`, version, content FROM grids WHERE user_id = ?");
        $stmt->execute([$userId]);
        echo json_encode(['success' => true, 'grids' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // GET /api/grids/{id}
    public function getOne($id) {
        $userId = $this->checkAuth();
        $stmt = $this->pdo->prepare("SELECT id, name, cols, `rows`, version, content FROM grids WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $grid = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($grid) {
            echo json_encode(['success' => true, 'grid' => $grid]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Grille introuvable']);
        }
    }

    // POST /api/grids (Création)
    public function create() {
        $userId = $this->checkAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        try {
            $stmt = $this->pdo->prepare("INSERT INTO grids (user_id, name, cols, `rows`, version, content) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $userId, 
                $data['name'] ?? 'Sans nom', 
                $data['cols'] ?? 13, 
                $data['rows'] ?? 17, 
                $data['version'] ?? 2, 
                json_encode($data['content'] ?? null)
            ]);

            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $this->pdo->lastInsertId(), 'message' => 'Grille créée']);
        } catch (PDOException $e) {
            if ($e->getCode() == '23000' || strpos($e->getMessage(), '1062 Duplicate entry') !== false) {
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'error' => 'Une grille portant ce nom existe déjà. Veuillez en choisir un autre.'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false, 
                    'error' => 'Erreur interne du serveur lors de la création.'
                ]);
            }
        }
    }

    // PUT /api/grids/{id} (Mise à jour)
    public function update($id) {
        $userId = $this->checkAuth();
        $data = json_decode(file_get_contents('php://input'), true);

        try {
            $stmt = $this->pdo->prepare("UPDATE grids SET name = ?, cols = ?, `rows` = ?, version = ?, content = ? WHERE id = ? AND user_id = ?");
            $stmt->execute([
                $data['name'] ?? 'Sans nom',
                $data['cols'] ?? 13,
                $data['rows'] ?? 17,
                $data['version'] ?? 2,
                json_encode($data['content'] ?? null),
                $id,
                $userId
            ]);

            echo json_encode(['success' => true, 'message' => 'Grille mise à jour']);
        } catch (PDOException $e) {
            if ($e->getCode() == '23000' || strpos($e->getMessage(), '1062 Duplicate entry') !== false) {
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'error' => 'Une grille portant ce nom existe déjà. Veuillez en choisir un autre.'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false, 
                    'error' => 'Erreur interne du serveur lors de la mise à jour.'
                ]);
            }
        }
    }

    // DELETE /api/grids/{id}
    public function delete($id) {
        $userId = $this->checkAuth();
        $stmt = $this->pdo->prepare("DELETE FROM grids WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        echo json_encode(['success' => true, 'message' => 'Grille supprimée']);
    }
}