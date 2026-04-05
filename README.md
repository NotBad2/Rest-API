# MyApp - API REST para Gestão de Cinemas 

Uma API REST desenvolvida em Node.js com Express e MongoDB para gestão de cinemas, filmes e utilizadores.

## 📋 Funcionalidades

- **Gestão de Filmes**: CRUD completo para filmes com paginação
- **Gestão de Utilizadores**: CRUD completo para utilizadores com paginação
- **Gestão de Cinemas**: CRUD completo para cinemas com paginação
- **Paginação**: Todas as listagens incluem paginação para melhor performance
- **Validação**: Validação de parâmetros de entrada para garantir integridade dos dados

## 🚀 Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express** - Framework web para Node.js
- **MongoDB** - Base de dados NoSQL
- **Nodemon** - Ferramenta para desenvolvimento (restart automático)

## 📦 Estrutura do Projeto

```
myapp/
├── app.js              # Ficheiro principal da aplicação
├── package.json        # Dependências e scripts do projeto
├── db/
│   └── config.js       # Configuração da base de dados MongoDB
└── routes/
    ├── movies.js       # Rotas para gestão de filmes
    ├── users.js        # Rotas para gestão de utilizadores
    └── cinemas.js      # Rotas para gestão de cinemas
```

## ⚙️ Instalação e Configuração

### Pré-requisitos
- Node.js (versão 14 ou superior)
- MongoDB Atlas ou instância local do MongoDB
- npm ou yarn

### Passos de Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/NotBad2/Rest-API
   cd myapp
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure a base de dados**
   
   Edite o ficheiro `db/config.js` e substitua a string de conexão pela sua:
   ```javascript
   const connectionString = "mongodb+srv://seu-usuario:sua-password@seu-cluster.mongodb.net/";
   ```

4. **Inicie a aplicação**
   ```bash
   npm start
   ```

A aplicação estará disponível em `http://localhost:3000`

## 🔌 Endpoints da API

### Filmes (`/movies`)
- `GET /movies?page=1&limit=10` - Listar todos os filmes com paginação
- `GET /movies/:id` - Obter um filme específico
- `POST /movies` - Criar um novo filme
- `PUT /movies/:id` - Atualizar um filme
- `DELETE /movies/:id` - Eliminar um filme

### Utilizadores (`/users`)
- `GET /users?page=1&limit=10` - Listar todos os utilizadores com paginação
- `GET /users/:id` - Obter um utilizador específico
- `POST /users` - Criar um novo utilizador
- `PUT /users/:id` - Atualizar um utilizador
- `DELETE /users/:id` - Eliminar um utilizador

### Cinemas (`/cinemas`)
- `GET /cinemas?page=1&limit=10` - Listar todos os cinemas com paginação
- `GET /cinemas/:id` - Obter um cinema específico
- `POST /cinemas` - Criar um novo cinema
- `PUT /cinemas/:id` - Atualizar um cinema
- `DELETE /cinemas/:id` - Eliminar um cinema

## 📝 Exemplos de Utilização

### Listar filmes com paginação
```bash
curl -X GET "http://localhost:3000/movies?page=1&limit=5"
```

### Criar um novo filme
```bash
curl -X POST "http://localhost:3000/movies" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Exemplo de Filme",
    "director": "Nome do Realizador",
    "year": 2024,
    "genre": "Drama"
  }'
```

### Obter utilizador específico
```bash
curl -X GET "http://localhost:3000/users/64a7f123456789abcdef0123"
```

## 📊 Parâmetros de Paginação

Todas as rotas de listagem suportam os seguintes parâmetros:

- `page` (obrigatório): Número da página (inteiro positivo)
- `limit` (obrigatório): Número de itens por página (inteiro positivo)

**Exemplo**: `/movies?page=2&limit=20`

Se os parâmetros não forem fornecidos, a API redirecionará automaticamente para `page=1&limit=10`.

## 🛠️ Scripts Disponíveis

- `npm start` - Inicia a aplicação com nodemon (desenvolvimento)
- `npm test` - Executa os testes (atualmente não implementados)

## 🔧 Desenvolvimento

Para desenvolvimento, o projeto utiliza **nodemon** que reinicia automaticamente a aplicação quando há alterações nos ficheiros.

```bash
npm start
```

## 📄 Base de Dados

A aplicação utiliza MongoDB com as seguintes coleções:
- `movies` - Armazena informações dos filmes
- `users` - Armazena informações dos utilizadores
- `cinemas` - Armazena informações dos cinemas

