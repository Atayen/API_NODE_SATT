class responseHandler {
    constructor() {}

    makeResponseData = (res, code, message, data = null, id = false) => {
        return res.status(code).send({
            code,
            message,
            data,
            ...(id && { id }),
        })
    }
    makeResponseError = (res, code, error) => {
        if (!res.status) return
        return res.status(code).send({
            code,
            error,
        })
    }
}

module.exports.responseHandler = new responseHandler()
