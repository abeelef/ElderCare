require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const admin = require("./firebase");
const db = admin.firestore();

// Importem Swagger
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const app = express();

// Configuració bàsica de Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "ElderCare API",
      description: "Documentació de l'API REST d'ElderCare",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Servidor local",
      },
    ],
  },
  // **paths**: indica on buscarem els comentaris de swagger. 
  // Per exemple, si tens arxius .js en la carpeta 'routes', 
  // pots posar ["routes/*.js"] o semblant. Aquí, per senzillesa, només server.js.
  apis: ["server.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Ruta per accedir a la documentació de Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Ruta bàsica
app.get("/", (req, res) => {
  res.send("Benvingut a ElderCare API!");
});

/**
 * @swagger
 * /users_list:
 *   get:
 *     summary: Obtenir tots els usuaris
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Retorna la llista de tots els usuaris
 */
app.get("/users_list", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (error) {
    console.error("Error en obtenir usuaris:", error);
    res.status(500).json({ error: "No s'han pogut obtenir els usuaris" });
  }
});

/**
 * @swagger
 * /add_user:
 *   post:
 *     summary: Crear un nou usuari
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuari creat correctament
 *       500:
 *         description: Error en crear l'usuari
 */
app.post("/add_user", async (req, res) => {
    try {
      // Agafem les dades del body
      const { name, email } = req.body;
  
      // Si vols afegir més camps, els pots incloure també al JSON
      const newUser = {
        name,
        email,
        createdAt: new Date()
      };
  
      // Afegim l'usuari a la col·lecció "users"
      const docRef = await db.collection("users").add(newUser);
  
      // Retornem l'id generat i les dades
      res.status(201).json({ id: docRef.id, ...newUser });
    } catch (error) {
      console.error("Error en crear l'usuari:", error);
      res.status(500).json({ error: "No s'ha pogut crear l'usuari" });
    }
  });
  

// Configuració del port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`);
  console.log(`Documentació de l'API disponible a http://localhost:${PORT}/api-docs`);
});
