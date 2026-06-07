<?php

require_once __DIR__ . '/../model/User.php';

class UserController
{
    private User $userModel;

    public function __construct()
    {
        // Controller coordena o caso de uso e delega persistencia ao model.
        $this->userModel = new User();
    }

    public function register(): void
    {
        // Le o JSON enviado pelo Angular no corpo da requisicao.
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.'
            ]);
        }

        $name = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = trim($body['password'] ?? '');
        $confirmarSenha = trim($body['confirmarSenha'] ?? '');

        // Validacoes de entrada ficam antes de qualquer acesso ao banco.
        if ($name === '' || $email === '' || $password === '' || $confirmarSenha === '') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Preencha todos os campos.'
            ]);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'E-mail invalido.'
            ]);
        }

        if ($password !== $confirmarSenha) {
            $this->respond(400, [
                'success' => false,
                'message' => 'As senhas precisam ser iguais.'
            ]);
        }

        try {
            // Regra de negocio: nao permite cadastrar o mesmo email duas vezes.
            if ($this->userModel->findByEmail($email)) {
                $this->respond(409, [
                    'success' => false,
                    'message' => 'Este e-mail ja esta cadastrado.'
                ]);
            }

            $user = $this->userModel->create($name, $email, $password);
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];

            $this->respond(201, [
                'success' => true,
                'message' => 'Usuario cadastrado com sucesso.',
                'user' => $user
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao cadastrar usuario.'
            ]);
        }
    }

    public function login(): void
    {
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.'
            ]);
        }

        $email = trim($body['email'] ?? '');
        $password = trim($body['password'] ?? '');

        if ($email === '' || $password === '') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Preencha todos os campos.'
            ]);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'E-mail invalido.'
            ]);
        }

        try {
            $user = $this->userModel->findByEmailForLogin($email);

            if (!$user || !password_verify($password, $user['password_hash'] ?? '')) {
                $this->respond(401, [
                    'success' => false,
                    'message' => 'E-mail ou senha invalidos.'
                ]);
            }

            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];

            unset($user['password_hash']);

            $this->respond(200, [
                'success' => true,
                'message' => 'Login realizado com sucesso.',
                'user' => $user
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao realizar login.'
            ]);
        }
    }

    public function perfil(): void
    {
        $userId = $this->requireAuth();
        $user = $this->userModel->findById($userId);

        if (!$user) {
            $this->respond(404, [
                'success' => false,
                'message' => 'Usuario nao encontrado.'
            ]);
        }

        $this->respond(200, [
            'success' => true,
            'message' => 'Usuario autenticado.',
            'user' => $user,
            'session' => [
                'id' => session_id(),
                'user_id' => $_SESSION['user_id']
            ]
        ]);
    }

    public function logout(): void
    {
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();

        $this->respond(200, [
            'success' => true,
            'message' => 'Logout realizado com sucesso.'
        ]);
    }

    private function requireAuth(): int
    {
        if (!isset($_SESSION['user_id'])) {
            $this->respond(401, [
                'success' => false,
                'message' => 'Usuario nao autenticado.'
            ]);
        }

        return (int) $_SESSION['user_id'];
    }

    private function respond(int $statusCode, array $data): void
    {
        // Padroniza respostas JSON da API.
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}
