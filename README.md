
# CafeFinance Ready

Arquitetura Docker completa com:

- Angular Frontend
- Nginx Proxy
- PHP API
- Python API
- PostgreSQL
- PgAdmin

## Estrutura

frontend/
php-api/
python-api/
nginx/
database/

## Subir o projeto

docker compose up --build

## URLs

Frontend:
http://localhost

PHP API:
http://localhost/api/php/

Python API:
http://localhost/api/python/

PgAdmin:
http://localhost:5050

## PostgreSQL

Host: postgres
Banco: app_db
Usuario: app_user
Senha: app_pass

## Healthchecks

Todos os containers possuem healthcheck configurado.

## Observações

- O frontend está preparado para evolução futura em Angular.
- O backend PHP possui suporte PostgreSQL.
- O backend Python usa FastAPI.
- O Nginx funciona como proxy reverso.
