import dotenv from "dotenv";

dotenv.config();

export type AppEnv = {
  Port: number;
  MongoUrl: string;
  CorsOrigin: string;
};

export function GetEnv(): AppEnv {
  return {
    Port: Number(process.env.PORT || 4010),
    MongoUrl: process.env.MONGO_URL || "mongodb://127.0.0.1:27017/c270_fa",
    CorsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  };
}

