import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";
const router = express.Router();

// 2 (Listar todos os users com paginação)
router.get("/", async (req, res) => {
    // Verificar se os parâmetros page e limit estão presentes
    if (!req.query.page || !req.query.limit) {
        // Redirecionar para a mesma rota com parâmetros padrão
        return res.redirect('/users?page=1&limit=10');
    }

    try {

        // Verificar se o input contêm outros caracteres que não números
        const isPageNumeric = /^\d+$/.test(req.query.page);
        const isLimitNumeric = /^\d+$/.test(req.query.limit);

        if (!isPageNumeric || !isLimitNumeric) {
            return res.status(400).send({error: 'A página e o limite devem ser números inteiros.' });
        }

        let page = parseInt(req.query.page);
        let limit = parseInt(req.query.limit);
        
        const totalDocs = await db.collection('users').countDocuments(); // Conta total de documentos
        const totalPages = Math.ceil(totalDocs / limit); // Calcula o total de páginas
        
        //Verifica se o numero da pagina existe
        if (page < 1 || page > totalPages) {
            return res.status(404).send({ error: "Página não existe" });
        }

        const currentPage = page;
        const results = await db.collection('users')
            .find({})
            .sort({_id: 1})
            .skip((currentPage - 1) * limit)
            .limit(parseInt(limit))
            .toArray();

        // contar o numero de docs da pagina atual
        const currentPageDocs = results.length
        
        // Definir a resposta de acordo com os resultados obtidos
        let prevPage = currentPage > 1 ? currentPage - 1 : 0;
        let nextPage = currentPage < totalPages ? currentPage + 1 : totalPages + 1;

        const response = {
            users: results,
            totalDocs,
            currentPageDocs,
            totalPages,
            currentPage
        };
        //Caso haja prevPage/nextPage com valores diferentes do valor de verificação, esta aparece na resposta, caso não, não aparece
        if (prevPage !== 0) response.prevPage = prevPage;
        if (nextPage !== totalPages + 1) response.nextPage = nextPage;
        
        return res.status(200).send(response);
    } catch (e) {
        res.status(500).send({ error: "Erro ao recuperar users: " + e.message});
    }
});

// Função para filtrar apenas os campos permitidos
function filterValidFields(user) {
    const allowedFields = ['name', 'gender', 'age', 'occupation', 'movies'];
    const filteredUser = {};

    for (const field of allowedFields) {
        if (user.hasOwnProperty(field)) 
            filteredUser[field] = user[field];
    }
    return filteredUser;
}

// funcao para validar se o user é válido
async function validateUser(user) {
    const errors = [];

    // Verificar campos obrigatórios
    if (!user.name || typeof user.name !== 'string' || !user.name.trim()) 
        errors.push("Campo 'name' inválido ou ausente");
    if (!user.gender || typeof user.gender !== 'string' || (user.gender !== 'F' && user.gender !== 'M')) 
        errors.push("Campo 'gender' inválido ou ausente");
    if (!user.age || typeof user.age !== 'number' || user.age <= 0)
        errors.push("Campo 'age' inválido ou ausente");
    if (!user.occupation || typeof user.occupation !== 'string' || !user.occupation.trim())
        errors.push("Campo 'occupation' inválido ou ausente");
    
    if (user.movies) {
        if (!Array.isArray(user.movies))
            errors.push("Campo 'movies' deve ser um array");
        else {
            for (let i = 0; i < user.movies.length; i++) {
                const movie = user.movies[i];
                if (typeof movie !== 'object' || movie === null) {
                    errors.push(`O item na posição ${i} do campo "movies" deve ser um objeto.`);
                } else {
                    if (!movie.movieid || typeof movie.movieid !== 'number' || movie.movieid <= 0)
                        errors.push(`O campo "movieid" do item na posição ${i} está inválido ou ausente (no array de movies)`);
                    // verificar se o filme existe
                    if (movie.movieid && typeof movie.movieid === 'number' && movie.movieid > 0) {
                        const movieExists = await db.collection('movies').findOne({ _id: movie.movieid });
                        if (!movieExists)
                            errors.push(`O filme com o id ${movie.movieid} não existe.`);
                    }
                    if (!movie.rating || typeof movie.rating !== 'number' || movie.rating < 1 || movie.rating > 5)
                        errors.push(`O campo "rating" do item na posição ${i} está inválido ou ausente (no array de movies)`);

                    // Verificar se existem campos nao permitidos
                    const extraFields = [];
                    for (const key in movie) {
                        if (key !== 'movieid' && key !== 'rating') 
                            extraFields.push(key);
                    }
                    if (extraFields.length > 0)
                        errors.push(`O item na posição ${i} contém campos não permitidos: ${extraFields.join(', ')}`);
                }
            }
        }
    }
    return errors;
}

// funcao para adicionar timestamp e a data a cada filme
function addTimestampAndDate(movies) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const currentDate = new Date().toISOString();
    return movies.map(movie => ({
        ...movie,
        timestamp: currentTimestamp,
        date: currentDate

    }));
}

// 4 (criar um novo utilizador/utilizadores)
router.post("/", async (req, res) => {
    try {
        const users = req.body;
        // Verificar se o body é um array de objetos
        if (!Array.isArray(users)) 
            return res.status(400).send({ error: "Os dados devem estar em um formato de array" });

        const errorsArray = [];
        for (let i = 0; i < users.length; i++) {
            let user = users[i];
            user = filterValidFields(user);
            
            const errors = await validateUser(user);
            
            if (errors.length > 0)
                errorsArray.push({ userIndex: i, errors });
        
            if (user.movies) {
                // Adicionar timestamp e data atuais aos filmes
                user.movies = addTimestampAndDate(user.movies);
                user.num_ratings = user.movies.length;
            }
            else{
                user.movies = [];
                user.num_ratings = 0;
            }
            users[i] = user;
        }
            
        if (errorsArray.length > 0)
            return res.status(400).send({ error: "Dados do user inválidos", details: errorsArray });

        const results = await db.collection('users').insertMany(users);
        res.status(201).send({message: "User/s adicionado/s com sucesso", results});
    } catch (e) {
        res.status(500).send({ error: "Erro ao recuperar users: "+ e.message });
    }
});

function checkId(id) {
    //id é um inteiro
    if (/^\d+$/.test(id)) return parseInt(id);
    // id é um objeto
    else if (ObjectId.isValid(id)) return new ObjectId(id);
    // id é inválido
    else return null;
}

// 6 (retornar um utilizador pelo campo _id e os seus 5 filmes com mais pontuação))
router.get("/id/:user_id", async (req, res) => {
    let userId= checkId(req.params.user_id);
    if (userId === null) return res.status(400).send({ error: "Id do user inválido" });
   
    try {
        // vai buscar o user pelo id para saber se existe antes de fazer a agregação
        let user = await db.collection('users').findOne({_id: userId});
        if (!user) return res.status(404).send({ error: "User não encontrado" });

        // se o user não tiver avaliado nenhum filme
        if (user.movies.length === 0) {
            const userWithoutMovies = {
                _id: user._id,
                name: user.name,
                gender: user.gender,
                age: user.age,
                occupation: user.occupation,
                num_ratings: user.num_ratings,
                topMovies: "O user não avaliou nenhum filme"
            };
            return res.status(200).send(userWithoutMovies);
        }
        
        // se o user tiver avaliado filmes, analisa-os e devolve os 5 com maior pontuação
        const ratingsAggregation = await db.collection('users').aggregate([
            { $match: { _id: userId } },
            { $unwind: "$movies" },
            { $sort: { "movies.rating": -1 } },
            { $limit: 5 },
            { $group: { 
                _id: "$_id",
                topMovies: { $push: "$movies" } // Este campo acumula os filmes processados
            } },
            { $project: { _id: 1, name: 1, gender: 1, age: 1, occupation: 1, num_ratings: 1, topMovies: 1 }}
        ]).toArray();

        res.send(ratingsAggregation).status(200);
        
    } catch (e) {
        res.status(500).send({ error: "Erro ao encontrar o user: " + e.message });
    }   
});


// 8 (eliminar um utilizador pelo campo _id)
router.delete("/id/:user_id", async (req, res) => {
    let userId= checkId(req.params.user_id);
    if (userId === null) return res.status(400).send({ error: "Id do user inválido" });

    try {
        // vai buscar o user pelo id para saber se existe antes de o apagar
        let user = await db.collection('users').findOne({_id: userId});
        if (!user) return res.status(404).send({ error: "User não existe" });

        let result = await db.collection('users').deleteOne({_id: userId});
        res.send({message: "User apagado com sucesso", result}).status(200);

    } catch (e) {
        res.status(500).send({ error: "Erro ao encontrar o user: " + e.message });
    } 
});

// funcao para validar se os campos do user estao em conformidade
async function validateUserToUpdate(user) {
    const errors = [];

    // Validações dos campos
    if (user.name && typeof user.name !== 'string') errors.push("O campo 'name' deve ser uma string");
    if (user.gender && !['M', 'F'].includes(user.gender)) errors.push("O campo 'gender' deve ser 'M' ou 'F'");
    if (user.age && (typeof user.age !== 'number' || user.age < 0)) errors.push("O campo 'age' deve ser um número inteiro positivo");
    if (user.occupation && typeof user.occupation !== 'string') errors.push("O campo 'occupation' deve ser uma string");
    if (user.movies) {
        if (!Array.isArray(user.movies)) {
            errors.push("O campo 'movies' deve ser um array");
        } else {
            for (let i = 0; i < user.movies.length; i++) {
                const movie = user.movies[i];
                if (typeof movie !== 'object' || movie === null) {
                    errors.push(`O item na posição ${i} do campo "movies" deve ser um objeto.`);
                } else {
                    if (typeof movie.movieid !== 'number' || movie.movieid <= 0) {
                        errors.push(`O campo "movieid" do item na posição ${i} deve ser um número inteiro positivo.`);
                    }
                    if (movie.movieid) {
                        const movieExists = await db.collection('movies').findOne({ _id: movie.movieid });
                        if (!movieExists) {
                            errors.push(`O filme com o id ${movie.movieid} não existe.`);
                        }
                    }
                    if (typeof movie.rating !== 'number' || movie.rating < 1 || movie.rating > 5) {
                        errors.push(`O campo "rating" do item na posição ${i} deve ser um número entre 1 e 5.`);
                    }
                    const extraFields = [];
                    for (const key in movie) {
                        if (key !== 'movieid' && key !== 'rating') extraFields.push(key);
                    }
                    if (extraFields.length > 0)
                        errors.push(`O item na posição ${i} contém campos não permitidos: ${extraFields.join(', ')}`);
                    
                }
            }
        }
    }

    return errors;
}

// 10 (atualizar um utilizador pelo campo _id)
router.put("/id/:user_id", async (req, res) => {
    try {
        const userId = checkId(req.params.user_id);
        if (!userId) return res.status(400).send({ error: "Id do user inválido" });

        const user = await db.collection('users').findOne({ _id: userId });
        if (!user) return res.status(404).send({ error: "User não existe" });

        if (Array.isArray(req.body)) return res.status(400).send({ error: "Os dados devem estar em um formato de objeto" });
        const body = filterValidFields(req.body);
        const errors = await validateUserToUpdate(body);
        if (errors.length > 0) return res.status(400).send({ error: "Dados do user inválidos", details: errors });

        if (Object.keys(body).length === 0) return res.status(400).send({ error: "Não foram fornecidos campos válidos para atualizar" });

        if (body.movies){
            body.num_ratings = body.movies.length;
            body.movies = addTimestampAndDate(body.movies);
        } 

        const result = await db.collection('users').updateOne({ _id: userId }, { $set: body });
        res.status(200).send({message: "User atualizado com sucesso", result });
    } catch (err) {
        res.status(500).send({ error: "Erro ao atualizar o user" });
    }
});



// 14  (mostrar estatisticas de cada user, ordenado por avg_rating)
router.get("/stats", async (req, res) => {
    try {
        const stats = await db.collection('users').aggregate([
            { $unwind: "$movies" },
            { $group: {
                _id: "$_id",
                name: { $first: "$name" },
                max_rating: { $max: "$movies.rating" },
                min_rating: { $min: "$movies.rating" },
                avg_rating: { $avg: "$movies.rating" }
            } },
            { $sort: { avg_rating: 1 } }
        ]).toArray();

        res.status(200).send(stats);
    } catch (e) {
        res.status(500).send({ error: "Erro ao encontrar os stats: " + e.message });
    }
});

export default router;