import pino from "pino";
import fs from "fs";
import path from "path";

const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const logger = pino(
  {
    level: "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.transport({
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        options: {
          destination: path.join(logDir, "telemetry.log"),
          mkdir: true,
        },
      },
    ],
  }),
);
