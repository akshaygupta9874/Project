import { ErrorRequestHandler } from "express";

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

const errorHandler: ErrorRequestHandler = (error: HttpError, _request, response, _next) => {
  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode === 500 ? "Internal Server Error" : error.message;

  console.error(error);

  response.status(statusCode).json({
    message
  });
};

export default errorHandler;
