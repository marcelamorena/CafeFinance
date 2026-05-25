# CafeFinance Ready

Arquitetura fullstack dockerizada utilizando:

- Angular SPA
- Nginx Reverse Proxy
- PHP API
- Python FastAPI
- PostgreSQL
- PgAdmin
- Docker Compose

---

# Arquitetura da Aplicação

```txt
Angular SPA
      ↓
Nginx Reverse Proxy
   ↓              ↓
PHP API       Python FastAPI
        ↓
    PostgreSQL
```

---

# Estrutura do Projeto

```txt
CAFEFINACE_READY/
│
├── frontend/
│   └── cafefinance/
│
├── php-api/
│   └── cafefinance-php/
│
├── python-api/
│   └── cafefinance-python/
│
├── nginx/
│
├── database/
│
├── docker-compose.yml
│
└── README.md
```

---
# Apagar imagens e ambiente  completo

 --- docker compose down

# Subir ambiente

```bash
docker compose up --build
```

---

# URLs

| Serviço | URL |
|---|---|
| Frontend Angular | http://localhost |
| Angular direto | http://localhost:4200 |
| PHP API | http://localhost/api/php |
| Python API | http://localhost/api/python |
| PgAdmin | http://localhost:5050 |

---

# PostgreSQL

| Configuração | Valor    |
|   ---        |---       |
| Host         | postgres |
| Porta        | 5432     |
| Banco        | app_db   |
| Usuário      | app_user |
| Senha        | app_pass |

---

# Observações

- Angular roda em Node.js
- PHP utiliza PDO PostgreSQL
- Python utiliza FastAPI
- Nginx atua como proxy reverso
- Toda arquitetura está dockerizada


===========================================================================================



# CafeFinance Ready

Arquitetura fullstack dockerizada utilizando:

* Angular SPA
* Nginx Reverse Proxy
* PHP API
* Python FastAPI
* PostgreSQL
* PgAdmin
* Docker Compose

---

# Arquitetura da Aplicação

```txt
Angular SPA
      ↓
Nginx Reverse Proxy
   ↓              ↓
PHP API       Python FastAPI
        ↓
    PostgreSQL
```

---

# Estrutura do Projeto

```txt
CAFEFINACE_READY/
│
├── frontend/
│   └── cafefinance/
│       ├── src/
│       ├── angular.json
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── php-api/
│   └── cafefinance-php/
│       ├── public/
│       │   └── index.php
│       ├── config/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── Dockerfile
│
├── python-api/
│   └── cafefinance-python/
│       ├── app/
│       │   └── main.py
│       ├── requirements.txt
│       └── Dockerfile
│
├── nginx/
│   └── default.conf
│
├── database/
│   └── init.sql
│
├── docker-compose.yml
│
└── README.md
```

---

# Tecnologias Utilizadas

| Tecnologia     | Função                   |
| -------------- | ------------------------ |
| Angular        | Frontend SPA             |
| Node.js        | Ambiente Angular         |
| Nginx          | Reverse Proxy            |
| PHP 8.2        | API REST                 |
| Python FastAPI | Serviços inteligentes    |
| PostgreSQL     | Banco de dados           |
| PgAdmin        | Administração PostgreSQL |
| Docker         | Containers               |
| Docker Compose | Orquestração             |

---

# Frontend Angular

O frontend foi criado utilizando Angular CLI.

## Criação do Projeto

```bash
npx @angular/cli new cafefinance --style=css --routing --skip-git
```

## Configurações utilizadas

| Configuração | Valor |
| ------------ | ----- |
| CSS          | Sim   |
| Routing      | Sim   |
| SSR/SSG      | Não   |
| SPA          | Sim   |

---

# Backend PHP

A API PHP foi desenvolvida em PHP puro com suporte PostgreSQL.

## Estrutura

```txt
public/
config/
controllers/
models/
routes/
services/
```

## Recursos

* API REST
* PDO PostgreSQL
* Estrutura modular
* Dockerizado

---

# Backend Python

A API Python utiliza FastAPI.

## Recursos

* FastAPI
* Uvicorn
* PostgreSQL
* Healthcheck
* Estrutura modular

## Endpoint de teste

```txt
GET /health
```

---

# PostgreSQL

## Configurações

| Configuração | Valor    |
| ------------ | -------- |
| Host         | postgres |
| Porta        | 5432     |
| Banco        | app_db   |
| Usuário      | app_user |
| Senha        | app_pass |

---

# PgAdmin

## Acesso

```txt
http://localhost:5050
```

## Login

| Campo | Valor                                     |
| ----- | ----------------------------------------- |
| Email | [admin@admin.com](mailto:admin@admin.com) |
| Senha | admin123                                  |

---

# Nginx Reverse Proxy

O Nginx centraliza todas as requisições.

## Rotas

| URL         | Destino        |
| ----------- | -------------- |
| /           | Angular        |
| /api/php    | PHP API        |
| /api/python | Python FastAPI |
| /pgadmin    | PgAdmin        |

---

# Docker Compose

## Subir o ambiente

```bash
docker compose up --build
```

---

## Derrubar ambiente

```bash
docker compose down
```

---

## Rebuild completo

```bash
docker compose down -v

docker compose up --build
```

---

# URLs da Aplicação

| Serviço          | URL                                                        |
| ---------------- | ---------------------------------------------------------- |
| Frontend Angular | [http://localhost](http://localhost)                       |
| Angular direto   | [http://localhost:4200](http://localhost:4200)             |
| PHP API          | [http://localhost/api/php](http://localhost/api/php)       |
| Python API       | [http://localhost/api/python](http://localhost/api/python) |
| PgAdmin          | [http://localhost:5050](http://localhost:5050)             |

---

# Healthchecks

Todos os containers possuem healthcheck configurado.

| Serviço    | Healthcheck |
| ---------- | ----------- |
| PostgreSQL | pg_isready  |
| Angular    | HTTP 4200   |
| PHP API    | HTTP 80     |
| Python API | /health     |
| Nginx      | HTTP 80     |

---

# Fluxo da Aplicação

```txt
Usuário
   ↓
Angular SPA
   ↓
Nginx Reverse Proxy
   ↓
┌──────────────┬──────────────┐
│ PHP API      │ Python API   │
└──────────────┴──────────────┘
        ↓
    PostgreSQL
```

---

# Benefícios da Arquitetura

* Frontend desacoplado
* APIs independentes
* Banco centralizado
* Dockerizado
* Escalável
* Fácil manutenção
* Fácil deploy
* Estrutura profissional
* Preparado para microserviços
* Preparado para CI/CD

---

# Comandos Úteis

## Ver containers

```bash
docker ps
```

---

## Ver logs

```bash
docker compose logs -f
```

---

## Reiniciar ambiente

```bash
docker compose restart
```

---

## Entrar no container PHP

```bash
docker exec -it php_api bash
```

---

## Entrar no container Python

```bash
docker exec -it python_api bash
```

---

## Entrar no PostgreSQL

```bash
docker exec -it postgres_db psql -U app_user -d app_db
```

---

# Observações Finais

* O frontend utiliza Angular SPA.
* O Angular roda em container Node.js.
* O PHP possui suporte PostgreSQL via PDO.
* O Python utiliza FastAPI.
* O PostgreSQL possui persistência via volume Docker.
* O Nginx funciona como gateway central da aplicação.
* Toda a aplicação está preparada para deploy futuro em produção.
