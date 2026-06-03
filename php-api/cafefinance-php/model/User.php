<?php

require_once __DIR__ . '/../config/Database.php';

class User
{
    private PDO $connection;

    public function __construct()
    {
        // O model acessa o banco, mas nao sabe como a conexao e criada.
        $this->connection = Database::getConnection();
        $this->ensureSchema();
    }

    public function findByEmail(string $email): ?array
    {
        // Consulta preparada evita concatenar dados do usuario no SQL.
        $stmt = $this->connection->prepare('SELECT id, name, email FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);

        $user = $stmt->fetch();

        return $user ?: null;
    }

    public function findLoginByEmail(string $email): ?array
    {
        $stmt = $this->connection->prepare('SELECT id, name, email, password_hash FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);

        $user = $stmt->fetch();

        return $user ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->connection->prepare('SELECT id, name, email FROM users WHERE id = :id');
        $stmt->execute([
            'id' => $id,
        ]);

        $user = $stmt->fetch();

        return $user ?: null;
    }

    public function create(string $name, string $email, string $password): array
    {
        // A senha nunca deve ser salva em texto puro: usamos hash seguro do PHP.
        $stmt = $this->connection->prepare(
            'INSERT INTO users (name, email, password_hash)
            VALUES (:name, :email, :password_hash)
            RETURNING id, name, email'
        );

        $stmt->execute([
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        return $stmt->fetch();
    }

    public function findByEmailForLogin(string $email): ?array
    {
        return $this->findLoginByEmail($email);
    }

    private function ensureSchema(): void
    {
        // Temporario para estudo: em projetos profissionais, use migrations.
        $this->connection->exec('
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');
        $this->connection->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
        $this->connection->exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)');
    }
}
