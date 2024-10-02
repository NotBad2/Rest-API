import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";
const router = express.Router();



//GET /cinemas (Listar todos os filmes com paginação)
router.get("/", async (req, res) => {
    // Verificar se os parâmetros page e limit estão presentes
    if (!req.query.page || !req.query.limit) {
        // Redirecionar para a mesma rota com parâmetros padrão
        return res.redirect('/cinemas?page=1&limit=10');
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

        const totalDocs = await db.collection('cinemas').countDocuments(); // Conta total de documentos
        const totalPages = Math.ceil(totalDocs / limit); // Calcula o total de páginas
        
        //Verifica se o numero da pagina existe
        if (page < 1 || page > totalPages) {
            return res.status(404).send({ error: "Página não existe" });
        }

        const currentPage = page;
        const results = await db.collection('cinemas')
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
            cinemas: results,
            totalDocs,
            currentPageDocs,
            totalPages,
            currentPage
        };
        //Caso haja prevPage, esta aparece na resposta, caso não, não aparece
        if (prevPage !== 0) {
            response.prevPage = prevPage;
        }
        //Caso haja nextPage, esta aparece na resposta, caso não, não aparece
        if (nextPage !== totalPages + 1) {
            response.nextPage = nextPage;
        }
        
        return res.status(200).send(response);
    } catch (e) {
        res.status(500).send({ error: "Erro ao recuperar cinemas" });
    }
});

// PUT /cinemas (Adicionar filmes da lista (movies.json) a cada cinema.)
router.put("/id/:id_cinema", async (req, res) => {
    try {
        let cinema_id = new ObjectId (req.params.id_cinema);
        // vai buscar o cinema pelo id
        const cinema = await db.collection('cinemas').findOne({ _id: cinema_id });

        //Verifica se o filme existe
        if (!cinema) {
            return res.status(404).send({ error: "Cinema não encontrado" });
        }

        // Na variavel filmes guardar a lista de filmes existente ou, caso nao exista, criar uma lista nova
        let movies = cinema.movies || []; 
        let filmesNaoAdicionados = [];

        // Verifica se o corpo da requisição contém a propriedade 'movies' e se é um array
        if (!req.body.movies) {
            return res.status(400).send({ error: "Corpo da requisição deve conter a propriedade 'movies'" });
        }

        // Verifica se é uma lista de filmes, ou só um
        if (!Array.isArray(req.body.movies)) {
            return res.status(400).send({ error: "Corpo da requisição deve conter a propriedade 'movies' como um array" });
        }

        for (let movieId of req.body.movies) {
            const filme = await db.collection('movies').findOne({ _id: movieId });
            
            // Verifica se o filme existe
            if (!filme) {
                // Guarda o filme na lista de filmes não encontrados
                filmesNaoAdicionados.push(movieId);
            } else if (!movies.includes(movieId)) {
                // Verifica se o filme já está na lista
                movies.push(movieId);
            }
        }

        if (filmesNaoAdicionados.length === req.body.movies.length) {
            return res.status(404).send({ error: "Filme/s não encontrado/s, insira o id correto" });
        }
        
        // Atualizar o cinema com a nova lista de filmes
        await db.collection('cinemas').updateOne({ _id: cinema_id }, { $set: { movies: movies } });

        let mensagem = "Filme/s adicionado/s com sucesso";
        if (filmesNaoAdicionados.length > 0) {
            mensagem += ", exceto o/s filme/s: " + filmesNaoAdicionados.join(", ") + " porque não existe/m.";
        }

        res.status(200).send({ message: mensagem });

    } catch(e){
        res.status(500).send({error: "Erro ao adicionar o/s filme/s: " + e.message})
    }
});


// Consultar filmes em exibição nos cinemas
router.get("/movies/:id_cinema", async (req, res) => {
    try {
        let cinema_id = new ObjectId (req.params.id_cinema);
        const cinema = await db.collection('cinemas').findOne({ _id: cinema_id});
        
        //verifica se o cinema existe
        if (!cinema) {
            return res.status(404).send({ error: "Cinema não encontrado" });
        }

        //verifica se o cinema tem a propriedade filmes ou se a lista de filmes está vazia
        if (!cinema.hasOwnProperty('movies') || cinema.movies.length===0) {
            return res.status(404).send({ error: "Não existem filmes em exibição neste cinema" });
        }

        let results=[]
        for (let movieId of cinema.movies) {
            let filme = await db.collection('movies').findOne({_id:movieId})
            results.push(filme)
        }
        

        res.status(200).send(results);
    } catch (e) {
        res.status(500).send({ error: "Erro ao recuperar filmes do cinema" });
    }
});


router.get('/near/lng_lat/:lng/:lat', async (req, res) => {
    const { lat, lng } = req.params;

    // Converter lat e lng para números decimais
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!latitude || !longitude) {
        return res.status(400).send({ error: "Latitude e longitude são requiridas." });
    }

    try {
        let results = await db.collection('cinemas').find({
            geometry: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: 5000 // 5 km
                }
            }
        }, {projection: {_id:1}}).toArray();
        
        if (results.length === 0) {
            return res.status(404).send({ error: "Não existem cinemas perto da localização especificada" });
        }
        
        res.status(200).json(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


router.get('/near/line/lng_lat/:lng1/:lat1/:lng2/:lat2', async (req, res) => {
    const { lat1, lng1, lat2, lng2 } = req.params;

    // Converter lat e lng para números decimais
    const latitude1 = parseFloat(lat1);
    const longitude1 = parseFloat(lng1);
    const latitude2 = parseFloat(lat2);
    const longitude2 = parseFloat(lng2);

    if (!latitude1 || !longitude1 || !latitude2 || !longitude2) {
        return res.status(400).send({ error: "Latitude e longitude para ambos os pontos são requiridas." });
    }

    try {
        let results = await db.collection('cinemas').find({
            geometry: {
                $geoIntersects: {
                    $geometry: {
                        type: "LineString",
                        coordinates: [
                            [longitude1, latitude1], 
                            [longitude2, latitude2]
                        ]
                    }
                }
            }
        }, {projection: {_id:1}}).toArray();
        
        if (results.length === 0) {
            return res.status(404).send({ error: "Não existem cinemas na linha especificada" });
        }
        
        res.status(200).json(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

router.get('/near/sum/lng_lat/:lng/:lat', async (req, res) => {
    const { lat, lng } = req.params;

    // Converter lat e lng para números decimais
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!latitude || !longitude) {
        return res.status(400).send({ error: "Latitude e longitude são requiridas." });
    }

    try {
        let count = await db.collection('cinemas').countDocuments({
            geometry: {
                $geoWithin: {
                    $centerSphere: [
                        [longitude, latitude],
                        5 / 6378.1 // 5 km em radianos
                    ]
                }
            }
        });
        
        if (count === 0) {
            return res.status(404).send({ error: "Não existem cinemas perto da localização especificada" });
        }
        
        res.status(200).json({ Cinemas: count});
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

//Verificar se um determinado user (Ponto) se encontra dentro do festival de cinema. 
router.get('/within/long_lat/:lng/:lat', async (req, res) => {
    
    try {
        // Extrai as coordenadas do ponto da requisição
        const latitude = parseFloat(req.params.lat);
        const longitude = parseFloat(req.params.lng);

        // verifica se as coordenadas sao fornecidas
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude e longitude devem ser fornecidas' });
        }

        let result=await db.collection("cinemas").find({
            geometry: {
                $geoIntersects:{
                    $geometry:{
                        type:"Point", 
                        coordinates:  [longitude, latitude]
                            
                    }
                }
            }
        }).toArray();
        
        if (result.length===0) {
            return res.status(400).json({ error: 'A pessoa não se encontra no festival do cinema' });
        }

        res.status(200).json(result);
    } catch (error) {
        console.error("Erro ao verificar o ponto:", error);
        res.status(500).json({ error: "Erro ao verificar o ponto." });
    }
});


export default router;