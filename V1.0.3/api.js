export default class API {
    constructor() {
        // On garde juste le prébase propre, ou "./api" sans répéter "./api" ensuite
        this.baseUrl = ".";
    }

    async getGrids() {

        try {
            const response = await fetch(`${this.baseUrl}/api/grids`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success && data.grids) {
                const gridsMap = {};
                data.grids.forEach(grid => {
                    const rawContent = grid.content || grid.grid_data;
                    let gridContent = typeof rawContent === 'string'
                        ? JSON.parse(rawContent)
                        : rawContent;

                    let finalCols = grid.cols !== undefined ? parseInt(grid.cols, 10) : (gridContent.cols || 13);
                    let finalRows = grid.rows !== undefined ? parseInt(grid.rows, 10) : (gridContent.rows || 17);

                    let finalCells = [];
                    let finalMysteryConfig = { length: 9 };

                    if (Array.isArray(gridContent)) {
                        finalCells = gridContent;
                    } else if (gridContent && typeof gridContent === 'object') {
                        finalCells = gridContent.cells || [];
                        if (gridContent.mysteryWordConfig) {
                            finalMysteryConfig = gridContent.mysteryWordConfig;
                        }
                    }

                    gridsMap[grid.name] = {
                        id: grid.id,
                        cols: finalCols,
                        rows: finalRows,
                        cells: finalCells,
                        mysteryWordConfig: finalMysteryConfig,
                        updated_at: grid.updated_at
                    };
                });
                return { success: true, grids: gridsMap };
            }
            return { success: false, error: data.error || "Impossible de récupérer les grilles." };
        } catch (err) {
            console.error("Erreur lors du chargement des grilles depuis le cloud :", err);
            return { success: false, error: "Erreur réseau lors du chargement des grilles." };
        }
    }

    async saveGrid(gridData, currentGridId, currentGridName, COLS, ROWS, mysteryWordConfig, cells) {

        const payload = {
            id: currentGridId,
            name: currentGridName,
            cols: COLS,
            rows: ROWS,
            version: gridData.version || 2,
            content: {
                cells: gridData.cells || cells,
                mysteryWordConfig: mysteryWordConfig
            }
        };

        const method = currentGridId ? 'PUT' : 'POST';
        const url = currentGridId ? `${this.baseUrl}/api/grids/${currentGridId}` : `${this.baseUrl}/api/grids`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.success) {
                return { success: true, id: data.id };
            } else {
                return { success: false, error: data.error || "Impossible de sauvegarder la grille." };
            }
        } catch (error) {
            console.error("Erreur réseau :", error);
            return { success: false, error: "Erreur réseau lors de la sauvegarde." };
        }
    }

    async deleteGrid(gridId) {

        try {
            const response = await fetch(`${this.baseUrl}/api/grids/${gridId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error("Réponse serveur invalide (non-JSON) :", rawText);
                return { success: false, error: "Le serveur a renvoyé une réponse invalide." };
            }

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || "Erreur lors de la suppression." };
            }
        } catch (err) {
            console.error("Erreur réseau :", err);
            return { success: false, error: "Impossible de contacter le serveur pour la suppression." };
        }
    }

    async handleLogin(email, password) {

        try {
            const response = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erreur de connexion' };
            }
        } catch (err) {
            return { success: false, error: 'Impossible de contacter le serveur.' };
        }
    }

    async handleRegister(first_name, last_name, email, password) {

        try {
            const response = await fetch(`${this.baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ first_name, last_name, email, password })
            });
            const data = await response.json();

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erreur lors de l\'inscription' };
            }
        } catch (err) {
            return { success: false, error: 'Impossible de contacter le serveur.' };
        }
    }

    async handleLogout() {
        try {
            await fetch(`${this.baseUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            location.reload();
        } catch (err) {
            console.error('Erreur lors de la déconnexion');
        }
    }

    async checkUserSession() {

        try {
            const response = await fetch(`${this.baseUrl}/api/user`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 401) {
                return { success: false, error: "Non autorisé" };
            }

            const data = await response.json();
            if (data.success && data.user) {
                return { success: true, user: data.user };
            }
            return { success: false, error: "Session invalide" };
        } catch (err) {
            return { success: false, error: "Erreur lors de la vérification de session" };
        }
    }

    async getUserTheme() {

        try {
            const response = await fetch(`${this.baseUrl}/api/user/preferences`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) return { success: false };

            const data = await response.json();
            if (data.success && data.preferences) {
                return { success: true, theme: data.preferences.theme || 'light' };
            }
            return { success: false };
        } catch (error) {
            return { success: false, error: error };
        }
    }

    async setUserTheme(newTheme) {

        try {
            const response = `${this.baseUrl}/api/user/preferences`;
            const fetchResponse = await fetch(response, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme }),
                credentials: 'include'
            });

            if (!fetchResponse.ok) {
                return { success: false, error: `Erreur HTTP : ${fetchResponse.status}` };
            }

            const data = await fetchResponse.json();
            if (data.success) {
                return { success: true, theme: data.theme || newTheme };
            } else {
                return { success: false, error: data.error || 'Impossible de sauvegarder le thème' };
            }
        } catch (error) {
            return { success: false, error: 'Erreur lors de la mise à jour du thème' };
        }
    }
}


