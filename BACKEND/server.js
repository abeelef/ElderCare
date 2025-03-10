require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// Middleware
app.use(express.json()); // Permet llegir JSON
app.use(cors()); // Habilita CORS per a totes les peticions
app.use(morgan("dev")); // Mostra logs a la consola

// Ruta bàsica
app.get("/", (req, res) => {
    res.send("Benvingut a ElderCare API!");
});

// Configuració del port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor escoltant a http://localhost:${PORT}`);
});
