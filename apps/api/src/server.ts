import { CreateApp } from "./app.js";
import { GetEnv } from "./config/Env.js";
import { ConnectMongo } from "./db/MongoDb.js";

async function StartServer() {
  const env = GetEnv();

  await ConnectMongo();

  const app = CreateApp();

  app.listen(env.Port, () => {
    console.log(`C270_FA Agent API is running on http://localhost:${env.Port}`);
  });
}

StartServer().catch((error) => {
  console.error(error);
  process.exit(1);
});

