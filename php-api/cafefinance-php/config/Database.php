<?php

require_once __DIR__ . '/DatabaseFactory.php';

class Database
{
    // Singleton: guarda uma unica instancia de PDO durante a requisicao.
    private static ?PDO $connection = null;

    // Construtor privado impede criar Database com "new Database()".
    private function __construct()
    {
    }

    public static function getConnection(): PDO
    {
        // Lazy loading: a conexao so e criada quando alguem realmente precisa dela.
        if (self::$connection === null) {
            self::$connection = DatabaseFactory::createPostgresConnection();
        }

        return self::$connection;
    }
}
