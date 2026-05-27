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


    public function Login(): void {

    $body = json_decode(file_get_contents('php://input'), true);

    if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.'
            ]);
        }

        $email = trim($body['email'] ?? '');
        $password = trim($body['password'] ?? '');

        if($email === '' || $password === ''){
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





    }

    private function respond(int $statusCode, array $data): void
    {
        // Padroniza respostas JSON da API.
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}
