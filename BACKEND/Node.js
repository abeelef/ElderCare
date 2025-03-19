const admin = require("./firebase");
const db = admin.firestore();

async function addUser() {
    await db.collection("users").add({
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date(),
    });
    console.log("User added!");
}

addUser();
