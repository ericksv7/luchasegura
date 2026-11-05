import { app } from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`API de LuchaSegura escuchando en http://localhost:${config.port}`);
});
