<?php

// Entrada unica da API: todas as requisicoes passam por este arquivo.
header('Content-Type: application/json');

$allowedOrigins = ['http://localhost', 'http://localhost:4200'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
}

header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

// Responde a preflight requests do navegador antes de POST/PUT/etc.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_start();
// Depois dos headers, entregamos a decisao de rota para routes/api.php.
require_once __DIR__ . '/../routes/api.php';
