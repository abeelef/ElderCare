require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fileUpload = require("express-fileupload"); 
app.use(fileUpload()); // <-- Per rebre fitxers multipart/form-data
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const admin = require("./firebase"); // Arxiu on inicialitzes Firebase Admin
const db = admin.firestore();

// Preparem un "bucket" per a Firebase Storage
const bucket = admin.storage().bucket(); 

const app = express();

/* -------------- SWAGGER -------------- */
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
  apis: ["server.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/* -------------- MIDDLEWARE -------------- */
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(fileUpload()); // <-- Per rebre fitxers multipart/form-data

// Ruta bàsica
app.get("/", (req, res) => {
  res.send("Benvingut a ElderCare API!");
});

/**
 * @swagger
 * /upload_entorn:
 *   post:
 *     summary: Pujar un fitxer de l'entorn VR al servidor i desar-lo a Firebase
 *     tags: [VR Environments]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: El fitxer binari de l'entorn (ex. .pak, .zip)
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Fitxer pujat correctament
 *       400:
 *         description: Falta el fitxer
 *       500:
 *         description: Error en pujar el fitxer
 */

app.post("/upload_entorn", async (req, res) => {
  try {
    // 1) Comprovem que hi hagi un fitxer en la petició
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No s'ha rebut cap fitxer" });
    }

    // 2) Llegim les metadades (si s'envien)
    const { name, description } = req.body;

    // 3) Pugem el fitxer a Firebase Storage
    const uploadedFile = req.files.file;
    // Creem un nom de fitxer únic al bucket
    const storageFileName = `unreal-envs/${Date.now()}_${uploadedFile.name}`;

    // Desem el buffer de dades a Firebase Storage
    await bucket.file(storageFileName).save(uploadedFile.data, {
      metadata: {
        contentType: uploadedFile.mimetype,
      },
    });

    // 4) Opcionalment, generem un Signed URL per descarregar el fitxer
    //    (Només si vols que sigui accessible públicament sense autenticar)
    const fileRef = bucket.file(storageFileName);
    const [downloadURL] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-09-2099", // Data de caducitat de l'URL
    });

    // 5) Guardem la informació a Firestore
    const environmentData = {
      name: name || "Entorn sense nom",
      description: description || "",
      storagePath: storageFileName, // Per si necessites la referència interna al bucket
      downloadURL: downloadURL,     // Per descarregar l'arxiu
      createdAt: new Date(),
    };

    const docRef = await db.collection("environments").add(environmentData);

    // 6) Retornem una resposta amb la info guardada
    res.status(201).json({ id: docRef.id, ...environmentData });
  } catch (error) {
    console.error("Error en pujar l'entorn VR:", error);
    res.status(500).json({ error: "No s'ha pogut pujar l'entorn VR" });
  }
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
