const admin = require("firebase-admin");
const serviceAccount = require("../elder-care-4fa71-firebase-adminsdk-fbsvc-2d17bba156.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;

