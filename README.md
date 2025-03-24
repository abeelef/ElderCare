# GUIA PER CONNECTAR UNREAL I FIREBASE

Si vols **desar un entorn VR** (nivell, escena, configuració…) creat a Unreal Engine a **Firebase**, normalment has de combinar **Firestore** i **Firebase Storage**:

- **Firestore**: Emmagatzema la **informació estructurada** (metadades de l’entorn, títol, versió, escenaris disponibles, etc.).  
- **Firebase Storage**: Emmagatzema els **fitxers grans o binaris** (arxius `.uasset`, `.pak`, models 3D, textures, àudios, etc.).

## Flux general

1. **Unreal Engine** prepara o exporta (o serialitza) l’entorn VR:  
   - Pot ser un fitxer gran (ex. `.pak`, `.zip`) o un conjunt de fitxers.  
   - Pots incloure un **fitxer JSON** amb la informació bàsica (nom, descripció, posicions d’objectes…) o simplement passar-ho com a dades estructurades al cos de la petició POST.

2. **Enviament a l’API REST**:  
   - Unreal Engine fa una crida `POST /environment` (o `/environments`, etc.) enviant:  
     - El fitxer binari que representa l’entorn (o compressió d’aquest).  
     - Metadades (JSON) si cal.  

3. **Servidor Node.js**:  
   - Rep els fitxers i les dades.  
   - Puja el fitxer binari a **Firebase Storage**.  
   - Desa la referència (URL o `storagePath`) i la resta de metadades a **Firestore**.  
   - Torna una resposta a Unreal Engine amb l’`id` del document creat, l’URL d’on s’ha guardat, etc.

4. **Unreal Engine** pot, posteriorment, fer un `GET /environment/:id` per:  
   - Recollir el JSON de configuració (si es va guardar a Firestore).  
   - Descarregar el fitxer emmagatzemat a Firebase Storage i carregar-lo dins el joc en temps d’execució (o durant la fase de càrrega).

### Exemple de codi: Rutes d’upload i obtenció de l’entorn

#### 1 Instal·lar dependència per a la càrrega de fitxers

Al teu projecte Node, pots fer servir per exemple [express-fileupload](https://www.npmjs.com/package/express-fileupload):
```bash
npm install express-fileupload
```

#### 2 Configurar el servidor per acceptar fitxers

```js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fileUpload = require("express-fileupload");
const admin = require("./firebase");  // Arxiu on inicies Firebase Admin
const db = admin.firestore();
const bucket = admin.storage().bucket();  // Assumint que tens el bucket per defecte configurat

const app = express();

// Middleware bàsic
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Middleware per a l'upload de fitxers
app.use(fileUpload());

// Ruta bàsica
app.get("/", (req, res) => {
  res.send("Benvingut a ElderCare API!");
});

/**
 * Carregar un entorn VR (fitxer + metadades)
 * Ex.: POST /environments
 * Body (form-data):
 *  - file: el fitxer binari (p.ex. .pak o .zip)
 *  - name: nom de l’entorn
 *  - description: descripció (opcional)
 */
app.post("/environments", async (req, res) => {
  try {
    // 1) Validar que hi hagi fitxer
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No s'ha rebut cap fitxer" });
    }

    // 2) Agafar les metadades (si existeixen)
    const { name, description } = req.body;

    // 3) Pujar el fitxer a Firebase Storage
    //    req.files.file és un objecte de express-fileupload
    const uploadedFile = req.files.file;

    // Creem un nom de fitxer al bucket, per exemple:
    const storageFileName = `environments/${Date.now()}_${uploadedFile.name}`;

    // Pujar-ho directament des del buffer a Firebase Storage
    await bucket.file(storageFileName).save(uploadedFile.data, {
      metadata: { contentType: uploadedFile.mimetype },
    });

    // Generar un URL signat (opcional) per descarregar l’arxiu
    const fileRef = bucket.file(storageFileName);
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-09-2099" // data de caducitat, per exemple
    });

    // 4) Crear el document a Firestore
    const environmentData = {
      name: name || "Entorn sense nom",
      description: description || "",
      storagePath: storageFileName, // Per si necessitem referència interna
      downloadURL: url,             // Per descarregar el fitxer
      createdAt: new Date()
    };

    const docRef = await db.collection("environments").add(environmentData);

    // 5) Retornar resposta
    res.status(201).json({ id: docRef.id, ...environmentData });
  } catch (error) {
    console.error("Error en pujar l'entorn VR:", error);
    res.status(500).json({ error: "No s'ha pogut pujar l'entorn VR" });
  }
});

/**
 * Obtenir dades d'un entorn VR a partir del seu ID
 */
app.get("/environments/:id", async (req, res) => {
  try {
    const docRef = db.collection("environments").doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Entorn no trobat" });
    }

    // docSnap.data() conté { name, description, storagePath, downloadURL, createdAt, ...}
    const environmentData = { id: docSnap.id, ...docSnap.data() };

    res.status(200).json(environmentData);
  } catch (error) {
    console.error("Error en obtenir l'entorn VR:", error);
    res.status(500).json({ error: "No s'ha pogut obtenir l'entorn VR" });
  }
});

// Configuració del port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`);
});
```

### Com carregar-ho des d’Unreal Engine
1. **Pujar l’entorn**:  
   - Fes una crida `POST` a `/environments` amb el fitxer binari. A Unreal, pots usar `FHttpModule` o plugins de HTTP.  
   - En el body, cal enviar el fitxer com a “form-data” (multipart), i si cal, els camps addicionals (`name`, `description`, etc.).  
2. **Descarregar-ho**:  
   - Fes una crida `GET /environments/:id`.  
   - Rebràs un JSON amb la informació i l’URL signat (`downloadURL`) per descarregar el fitxer del bucket.  
   - Després, a Unreal pots descarregar el fitxer binari i processar-lo (per exemple, si és un `.pak` amb l’entorn).  

### Conclusió
- **Firestore**: Desa la part “estructurada” (nom, descripció, timestamps i referències al fitxer).  
- **Storage**: Desa el fitxer complet de l’entorn VR.  
- **API REST**: Exposa les rutes perquè l’Unreal Engine (o qualsevol altre client) pugui enviar i rebre dades.  
- **Unreal Engine**:  
  - Pot generar el fitxer de l’entorn i enviar-lo via HTTP.  
  - Pot rebre la resposta (URLs, metadades) i reconstruir l’experiència.  

Aquesta és l’estratègia típica per **“guardar l’entorn VR d’Unreal Engine a Firebase”** utilitzant un servidor Node com a pont. També pots afegir gestió d’usuaris, permisos, xifrat, etc., segons la complexitat que necessitis.