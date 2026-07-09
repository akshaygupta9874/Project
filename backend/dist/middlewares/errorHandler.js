const errorHandler = (error, _request, response, _next) => {
    const statusCode = error.statusCode || error.status || 500;
    const message = statusCode === 500 ? "Internal Server Error" : error.message;
    console.error(error);
    response.status(statusCode).json({
        message
    });
};
export default errorHandler;
//# sourceMappingURL=errorHandler.js.map