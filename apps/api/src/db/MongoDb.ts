import mongoose from "mongoose";
import { GetEnv } from "../config/Env.js";

export async function ConnectMongo() {
  const env = GetEnv();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(env.MongoUrl);
  return mongoose.connection;
}

