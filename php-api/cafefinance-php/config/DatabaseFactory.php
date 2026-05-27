<?php

class DatabaseFactory
{
    public static function createPostgresConnection(): PDO
    {
        // Factory: centraliza como uma conexao PostgreSQL deve ser criada.
        $dsn = 'pgsql:host=postgres;port=5432;dbname=app_db';

        // PDO configurado para lancar excecoes e devolver arrays associativos.
        return new PDO($dsn, 'app_user', 'app_pass', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
}
