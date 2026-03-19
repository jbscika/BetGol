const admin = require('firebase-admin');

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('Firebase inicializado com sucesso!');
} catch (error) {
  console.error('Erro ao inicializar Firebase:', error.message);
}

const db = admin.firestore();

module.exports = { db };
