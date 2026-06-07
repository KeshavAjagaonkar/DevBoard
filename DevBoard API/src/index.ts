import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { auth } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import authRouter from "./routes/auth";
import applicationsRouter from "./routes/applications";
import analyticsRouter from "./routes/analytics";

const app = express();

app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/auth", authRouter);
app.use("/applications", auth, applicationsRouter);
app.use("/analytics", auth, analyticsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
