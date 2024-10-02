import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";
const router = express.Router();

// 1(Listar todos os filmes com paginação)
router.get("/", async (req, res) => {
    // Verificar se os parâmetros page e limit estão presentes
    if (!req.query.page || !req.query.limit) {
        // Redirecionar para a mesma rota com parâmetros padrão
        return res.redirect('/movies?page=1&limit=10');
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

        const totalDocs = await db.collection('movies').countDocuments(); // Conta total de documentos
        const totalPages = Math.ceil(totalDocs / limit); // Calcula o total de páginas

        //Verifica se o numero da pagina existe
        if (page < 1 || page > totalPages) {
            return res.status(404).send({ error: "Página não existe" });
        }

        const currentPage = page;
        const results = await db.collection('movies')
            .find({})
            .sort({_id: 1})
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .toArray();
        
        // contar o numero de docs da pagina atual
        const currentPageDocs = results.length
        
        // Definir a resposta de acordo com os resultados obtidos
        let prevPage = currentPage > 1 ? currentPage - 1 : 0;
        let nextPage = currentPage < totalPages ? currentPage + 1 : totalPages + 1;

        const response = {
            filmes: results,
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
        res.status(500).send({ error: "Erro ao recuperar filmes: " + e.message});
    }
});

// funcao para validar se o movie é válido
async function validateMovie(movie) {
    const errors = [];

    // Verificar campos obrigatórios
    if (!movie.title || typeof movie.title !== 'string' || !movie.title.trim())
        errors.push("Campo 'title' inválido ou ausente");
    if (!movie.year || typeof movie.year !== 'number' || movie.year <= 1500) 
        errors.push("Campo 'year' inválido ou ausente");
    if (!movie.genres || !Array.isArray(movie.genres) || movie.genres.length === 0){
        errors.push("Campo 'genres' inválido ou ausente. Deve ser um array e ter pelo menos um género");
    } else {
        //generos disponiveis
        const availableGenres = db.collection('movies').distinct('genres');
        for (const genre of movie.genres) {
            //generos devem ser string
            if (typeof genre !== 'string') 
                errors.push("Os géneros devem ser strings");
            //generos devem estar na lista de generos disponiveis
            else if (!availableGenres.includes(genre)) 
                errors.push(`O género '${genre}' não é válido. Os géneros disponíveis são: ${availableGenres.join(', ')}`);
        }
    }
    return errors;
}

// Função para filtrar apenas os campos permitidos
function filterValidFields(movie) {
    const allowedFields = ['title', 'year', 'genres'];
    const filteredMovie = {};

    for (const field of allowedFields) {
        if (movie.hasOwnProperty(field)) 
        filteredMovie[field] = movie[field];
    }
    return filteredMovie;
}



// 3 (criar um novo filme/filmes)
router.post("/", async (req, res) => {
    try {
        const movies = req.body;
        // Verificar se o body é um array de objetos
        if (!Array.isArray(movies))
            return res.status(400).send({ error: "Os dados devem estar em um formato de array" });

        const errorsArray = [];
        for (let i = 0; i < movies.length; i++) {
            let movie = movies[i];
            movie = filterValidFields(movie);

            const errors = await validateMovie(movie);
            if (errors.length > 0)
                errorsArray.push({ movieIndex: i, errors });
            movies[i] = movie;
        }

        if (errorsArray.length > 0) 
            return res.status(400).send({ error: "Dados do filme inválidos", details: errorsArray });

        const results = await db.collection('movies').insertMany(movies);
        res.status(201).send({message: "Filme/s adicionado/s com sucesso", results});
    
    } catch (e) {
        res.status(500).send({ error: "Erro ao recuperar filmes: "+ e.message });
    }
});

function checkId(id) {
    if (/^\d+$/.test(id)) {
        //id é um inteiro
        return parseInt(id);
    } else if (ObjectId.isValid(id)) {
        // id é um objeto
        return new ObjectId(id);
    } else {
        // id é inválido
        return null;
    }
}

// 5 (retornar um filme pelo campo _id e calcular a média das pontuações)
router.get("/id/:movie_id", async (req, res) => {
    try {
        let movieId= checkId(req.params.movie_id);
        if (movieId === null) return res.status(400).send({ error: "Id do filme inválido" });
        
        // vai buscar o filme pelo id para saber se existe antes de fazer a agregação
        const movie = await db.collection('movies').findOne({ _id: movieId });
        if (!movie) return res.status(404).send({ error: "Filme não encontrado" });

        // Agrega as pontuações dos users para calcular a média
        const ratingsAggregation = await db.collection('users').aggregate([
            { $unwind: "$movies" }, // Desdobra o array de filmes
            { $match: { "movies.movieid": movieId } }, // Do array filmes, encontra o movieid que corresponde ao _id do filme
            { $group: { _id: null, averageRating: { $avg: "$movies.rating" } } } // Calcula a média das pontuações
        ]).toArray();

        // Adiciona a pontuação média ao objeto do filme, se houver pontuações
        if (ratingsAggregation.length > 0) 
            movie.averageRating = ratingsAggregation[0].averageRating;
        else 
            movie.averageRating = "Sem avaliações";

        res.status(200).send(movie);
    } catch (e) {
        res.status(500).send({ error: "Erro ao encontrar o filme: " + e.message });
    }
});


// 7 (eliminar um filme pelo campo _id)
router.delete("/id/:movie_id", async (req, res) => {
    try {
        let movieId= checkId(req.params.movie_id);
        if (movieId === null) return res.status(400).send({ error: "Id do filme inválido" });
        
        // vai buscar o filme pelo id para saber se existe antes de o apagar
        let movie = await db.collection('movies').findOne({_id: movieId});
        if (!movie) return res.status(404).send({ error: "Filme não existe" });

        let result = await db.collection('movies').deleteOne({_id: movieId});
        res.send({message: "Filme apagado com sucesso", result}).status(200);

    } catch (e) {
        res.status(500).send({ error: "Erro ao encontrar o filme: " + e.message });
    } 
});

// funcao para validar se os campos do filme estao em conformidade
async function validateMovieToUpdate(movie) {
    const errors = [];

    // Validações dos campos
    if (movie.title && typeof movie.title !== 'string') errors.push("O campo 'title' deve ser uma string");
    if (movie.year && (typeof movie.year !== 'number' || movie.year < 1500)) errors.push("O campo 'year' deve ser um número inteiro positivo e maior que 1500");
    if (movie.genres){
        if(!Array.isArray(movie.genres)) 
            errors.push("O campo 'genres' deve ser um array"); 
        else if (movie.genres.length === 0)
             errors.push("O campo 'genres' deve ter pelo menos um gênero");
        else {
            //generos disponiveis
            const availableGenres = await db.collection('movies').distinct('genres');
            for (const genre of movie.genres) {
                //generos devem ser string
                if (typeof genre !== 'string') 
                    errors.push("Os géneros devem ser strings");
                //generos devem estar na lista de generos disponiveis
                else if (!availableGenres.includes(genre)) 
                    errors.push(`O género '${genre}' não é válido. Os géneros disponíveis são: ${availableGenres.join(', ')}`);
            }
        }
    }
    return errors;
}

// 9 (atualizar um filme pelo campo _id)
router.put("/id/:movie_id", async (req, res) => {
    try {
        const movieId = checkId(req.params.movie_id);
        if (!movieId) return res.status(400).send({ error: "Id do filme inválido" });

        const movie = await db.collection('movies').findOne({ _id: movieId });
        if (!movie) return res.status(404).send({ error: "Filme não existe" });
        
        if (Array.isArray(req.body)) return res.status(400).send({ error: "Os dados devem estar em um formato de objeto" });
        const body = filterValidFields(req.body);
        const errors = await validateMovieToUpdate(body)
        if (errors.length > 0) return res.status(400).send({ error: "Dados do filme inválidos", details: errors });

        if (Object.keys(body).length === 0) return res.status(400).send({ error: "Não foram fornecidos campos válidos para atualizar" });

        let result = await db.collection('movies').updateOne({_id: movieId}, {$set: body});
        res.send({message: "Filme atualizado com sucesso", result }).status(200);
    } catch (err) {
        res.status(500).send({ error: "Erro ao atualizar o filme" });
    }
});

// 11 (Lista de N filmes com maior pontuacao média por ordem decrescente)
router.get('/higher/:num_movies', async (req, res) => {
    try{
        // Verificar se o input está no formato correto
        const isNum_moviesNumeric = /^\d+$/.test(req.params.num_movies);

        if (!isNum_moviesNumeric || req.params.num_movies <= 0) {
            return res.status(400).send({error: "O número de filmes deve ser um número inteiro positivo"});
        }

        let num_movies = parseInt(req.params.num_movies);
        
        const ratingsAggregation = await db.collection('users').aggregate([
            { $unwind: "$movies" }, // Desdobra o array de filmes
            { $group: { _id: "$movies.movieid", averageRating: { $avg: "$movies.rating" } } }, // Calcula a média das pontuações
            { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movieinfo' } }, // Junta com a coleção de filmes
            { $unwind: "$movieinfo" }, // Desdobra o array de detalhes do filme
            { $project: {_id:1, averageRating:1, title: "$movieinfo.title", genres: "$movieinfo.genres", year: "$movieinfo.year"}},
            { $sort: { averageRating: -1 } }, // Ordena os filmes por classificação média em ordem decrescente
            { $limit: num_movies } // Limita o número de filmes retornados para num_movies
        ]).toArray();

        if (ratingsAggregation.length === 0) 
            res.send({ message: "Não foram encontrados filmes" }).status(404);
        else
            res.send(ratingsAggregation).status(200);
} catch (error) {
    // Captura qualquer erro que possa ocorrer durante a execução do código
    res.status(500).send({ error: error.message });
}
});

//12 (Lista de filmes ordenados por :order (asc/desc) de acordo com a média das pontuações)
router.get('/ratings/:order', async (req, res) => {
    try{
        let order = req.params.order;

        if (order !== 'asc' && order !== 'desc') {
            return res.status(400).send({ error: "Parâmetro de ordenação inválido. Deve ser 'asc' ou 'desc'." });
        }

        order = order === 'asc' ? 1 : -1;

        const ratingsAggregation = await db.collection('users').aggregate([
            { $unwind: "$movies" }, // Desdobra o array de filmes
            { $group: { _id: "$movies.movieid", totalRatings: { $sum: "$movies.rating" } } }, // Conta o número total de classificações
            { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movieinfo' } }, // Junta com a coleção de filmes
            { $unwind: "$movieinfo" }, // Desdobra o array de detalhes do filme
            { $project: { _id: 1, totalRatings: 1, title: "$movieinfo.title"} }, // Seleciona os campos necessários
            { $sort: { totalRatings: order } } // Ordena os filmes por total de classificações em ordem especificada
        ]).toArray();
        
        if (ratingsAggregation.length === 0) 
            res.send({ message: "Não foram encontrados filmes" }).status(404);
        else
            res.send(ratingsAggregation).status(200);
    } catch (error) {
        // Captura qualquer erro que possa ocorrer durante a execução do código
        res.status(500).send({ error: error.message });
    }
    });

// 13 (Lista de filmes com o maior numero de 5 estrelas)
router.get('/star', async (req, res) => {
    try{
        const ratingsAggregation = await db.collection('users').aggregate([
            { $unwind: "$movies" }, // Desdobra o array de filmes
            { $group: { _id: "$movies.movieid", Ratings5: { $sum: { $cond: [ { $eq: [ "$movies.rating", 5 ] }, 1, 0 ] } } } }, // conta as classificações 5 estrelas
            { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movieinfo' } }, // Junta com a coleção de filmes
            { $unwind: "$movieinfo" }, // Desdobra o array de detalhes do filme
            {$project: {_id:1, Ratings5:1, title: "$movieinfo.title"}},
            { $sort: { Ratings5: -1 } }, // Ordena os filmes por classificação média em ordem decrescente
        ]).toArray();
        

        if (ratingsAggregation.length === 0) 
            res.send({ message: "Não foram encontrados filmes" }).status(404);
        else
            res.send(ratingsAggregation).status(200);
    } catch (error) {
        // Captura qualquer erro que possa ocorrer durante a execução do código
        res.status(500).send({ error: error.message });
    }
});

// 15 (Lista de filmes por {genre_name} e {year})
router.get("/genres/:genre_name/year/:year", async (req, res) => {
    try {
        // Verificar se os parâmetros estão presentes
        if (!req.params.genre_name || !req.params.year)
            return res.status(400).send({ error: "Os parâmetros 'genre_name' e 'year' são obrigatórios." });

        // Verificar se o input está no formato correto
        const isGenreString = /^[a-zA-Z]+$/.test(req.params.genre_name);
        const isYearNumeric = /^\d+$/.test(req.params.year);

        if (!isGenreString || !isYearNumeric) {
            return res.status(400).send({error: "O género só deve conter letras e o ano deve ser um número inteiro"});
        }

        let genre = req.params.genre_name;
        let year = req.params.year;

        // Verificar se o género fornecido existe
        const genres = await db.collection('movies').distinct('genres');
        if (!genres.includes(genre)) 
            return res.status(404).send({ error: "Género não encontrado. Verifique se a primeira letra é maiscúla e se está escrito da mesma forma", genresAvailable: genres});

        // Validar o ano
        if (parseInt(year)< 1500 || parseInt(year) > new Date().getFullYear()) 
            return res.status(400).send({ error: "O ano fornecido é inválido." });


        let results = await db.collection('movies').find({ genres: genre, year: year}, {projection: {_id:0}}).toArray();
        if (results.length === 0) 
            return res.status(404).send({ error: "Não foi encontrado nenhum filme com estas características" });
        
            res.send(results).status(200);
    }
    catch (e) {
        res.status(500).send({ error: "Erro ao encontrar o filme:" + e.message });
    }
});

// 16  (Lista todos os filmes com o título original em parêntesis, e criar um novo atributo (original_title) devolvido na resposta)
router.get("/originaltitle", async (req, res) => {
    try {
        const query = [
            {
                $match: {
                    title: { $regex: /\(.*\)/ } // Filtra filmes que têm parênteses
                }
            },
            {
                $project: {
                    title: { $split: ["$title", " ("] } // Divide o título no " ("
                }
            },
            {
                $set: {
                    title: { $arrayElemAt: ["$title", 0] }, // Ttitulo é a primeira parte da divisao
                    original_title: { 
                        $arrayElemAt: [ { $split: [{$arrayElemAt: ["$title", 1]}, ")"] }, 0] // titulo original é a segunda parte da divisao, mas como tem o parenteses no fim é preciso dividir outra vez e selecionar a primeira parte da divisao
                    }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ];

        const movies = await db.collection('movies').aggregate(query).toArray();
        res.status(200).send(movies);
    } catch (e) {
        res.status(500).send({ error: "Erro ao processar os filmes: " + e.message });
    }
});

export default router;