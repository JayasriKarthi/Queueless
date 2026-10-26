import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      // Build indexes automatically while developing; create them deliberately in production.
      autoIndex: env.NODE_ENV !== 'production',
    });
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  const { host, port, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}:${port}/${name}`);

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error(`MongoDB error: ${err.message}`));

  return mongoose.connection;
}

// Used by tests and graceful shutdown in server.js.
export async function disconnectDB() {
  await mongoose.disconnect();
}
