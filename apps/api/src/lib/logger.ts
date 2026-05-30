import pino from "pino";
import pinoPretty from "pino-pretty";

const isDev = process.env.NODE_ENV !== "production";

const prettyStream = isDev
  ? pinoPretty({
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname,req,res",
      singleLine: true,
      messageFormat: "{msg}",
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
  },
  prettyStream,
);
