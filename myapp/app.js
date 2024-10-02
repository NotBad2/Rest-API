import express from 'express'

import movies from "./routes/movies.js";
import users from "./routes/users.js";
import cinemas from "./routes/cinemas.js";

const app = express()
const port = 3000

// app.use(cors());
app.use(express.json());

// Load the /movies routes
app.use("/movies", movies);

// Load the /users routes
app.use("/users", users);

// Load the /cinemas routes
app.use("/cinemas", cinemas);

app.listen(port, () => {
  console.log(`backend listening on port ${port}`)
})
