const Joi = require('joi')

/**********
 *
 *  SCHEMA FOR JOI
 *
 *  **********************       */

// VALIDATION TRANSACTION PASSWORD
const validatePassword = () =>
    Joi.string()
        .min(8)
        .required()
        .custom((value) => {
            const RegUpperCase = RegExp('[A-Z]')
            const RegLowerCase = RegExp('[a-z]')
            const RegNumber = RegExp('[0-9]')
            const RegSpecialChar = RegExp('[^A-Za-z0-9]')
            if (
                RegUpperCase.test(value) &&
                RegLowerCase.test(value) &&
                RegNumber.test(value) &&
                RegSpecialChar.test(value)
            ) {
                return value
            } else throw Error('password not match')
        })

// VALIDATION NETWORK
const validateNetworks = (validNetworks) =>
    Joi.string()
        .allow(null)
        .required()
        .custom((value) => {
            for (let i = 0; i < validNetworks.length; i++) {
                if (validNetworks[i] === value.toString().toLowerCase()) {
                    return value
                }
            }
            throw Error('Networks supported are : ' + validNetworks)
        })

// VALIDATION ADDRESS
const validateAddress = (pattern) =>
    Joi.string().required().pattern(new RegExp(pattern))

// VALIDATION VERSION
const validateVersion = (validVersions) =>
    Joi.string()
        .required()
        .custom((value) => {
            for (let i = 0; i < validVersions.length; i++) {
                if (validVersions[i] === value) {
                    return value
                }
            }
            throw Error('Version supported are : ' + validVersions)
        })

// Validation schema for cryptolist
const validateCryptoList = () => Joi.string().pattern(/^(\d+(,\d+)*)?$/)

// SCHEMAS OBJECT
const schemas = {
    getCodeKeyStoreSchema: Joi.object({
        network: validateNetworks(['eth', 'btc', 'tron']),
        version: validateVersion(['1', '2']),
    }),

    exportKeyStoreSchema: Joi.object({
        code: Joi.number().required(),
        network: validateNetworks(['eth', 'btc', 'tron']),
        version: validateVersion(['1', '2']),
    }),

    walletVersionSchema: Joi.object({
        version: Joi.string().allow('').allow(null),
    }),

    networkSchema: Joi.object({
        network: validateNetworks([
            'erc20',
            'bep20',
            'polygon',
            'tron',
            'bttc',
            'arthera',
        ]),
    }),

    checkTokenSchema: Joi.object({
        network: validateNetworks([
            'erc20',
            'bep20',
            'polygon',
            'bttc',
            'tron',
        ]),
        tokenAdress: validateAddress('^0x[a-fA-F0-9]{40}$|T[A-Za-z1-9]{33}$'),
    }),

    checkEVMAddressSchema: Joi.object({
        address: validateAddress('^0x[a-fA-F0-9]{40}$|T[A-Za-z1-9]{33}$'),
    }),

    tokenSchema: Joi.object({
        tokenAdress: validateAddress(
            '^0x[a-fA-F0-9]{40}$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$|T[A-Za-z1-9]{33}$'
        ),
        decimal: Joi.number().required(),
        symbol: Joi.string().required(),
        network: validateNetworks([
            'erc20',
            'bep20',
            'polygon',
            'tron',
            'bttc',
        ]),
        tokenName: Joi.string().required(),
    }),

    passwordCheckSchema: Joi.object({
        pass: validatePassword(),
    }),

    paymentRequestSchema: Joi.object({
        currency: Joi.string().required(),
        idWallet: validateAddress(
            '^0x[a-fA-F0-9]{40}$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$|T[A-Za-z1-9]{33}$'
        ),
        quote_id: Joi.string().required(),
    }),

    getQuoteSchema: Joi.object({
        digital_currency: Joi.string().required(),
        requested_amount: Joi.number().required(),
        fiat_currency: Joi.string().required(),
        requested_currency: Joi.string().required(),
    }),

    sendTokenSchema: Joi.object({
        amount: Joi.number().unsafe().required(),
        from: validateAddress(
            '^0x[a-fA-F0-9]{40}$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$|T[A-Za-z1-9]{33}$'
        ),
        network: validateNetworks([
            'erc20',
            'bep20',
            'polygon',
            'btc',
            'tron',
            'bttc',
            'arthera',
        ]),
        pass: validatePassword(),
        to: validateAddress(
            '^0x[a-fA-F0-9]{40}$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$|T[A-Za-z1-9]{33}$'
        ),
        tokenAddress: Joi.custom((value) => {
            if (
                value === null ||
                RegExp(
                    '^0x[a-fA-F0-9]{40}$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$|T[A-Za-z1-9]{33}$'
                ).test(value) ||
                value.toString().toLowerCase() === 'trx'
            ) {
                return value
            } else throw Error('Invalid smart contract')
        }),
        tokenSymbol: Joi.string().required(),
    }),

    maxSendTokenQuerySchema: Joi.object({
        max: Joi.boolean(),
    }),

    migrationWalletSchema: Joi.object({
        tokens: Joi.array().required(),
        network: validateNetworks([
            'erc20',
            'bep20',
            'polygon',
            'btc',
            'tron',
            'bttc',
        ]),
        pass: validatePassword(),
    }),
    cryptoListSchema: Joi.object({
        cryptolist: validateCryptoList(),
    }),
}

/**********
 *
 *  MIDDLEWARE VALIDATION
 *
 *  **********************       */

// MIDDLEWARE FUNCTION
const validationMiddleware = (schema, property) => (req, res, next) => {
    const { error } = schema.validate(req[property])
    if (error) throw Error(error)
    else next()
}

// CUSTOM MIDDLEWARE FOR SEND TOKEN USING BODY AND QUERY
const validationCustomMiddleware =
    (schemaBody, schemaQuery) => (req, res, next) => {
        const { error } = schemaBody.validate(req.body)
        if (error) {
            throw Error(error)
        } else {
            const { error } = schemaQuery.validate(req.query)
            if (error) throw Error(error)
            else next()
        }
    }

module.exports = {
    getCodeKeyStoreValidation: validationMiddleware(
        schemas.getCodeKeyStoreSchema,
        'body'
    ),
    exportKeyStoreValidation: validationMiddleware(
        schemas.exportKeyStoreSchema,
        'body'
    ),
    walletVersionValidation: validationMiddleware(
        schemas.walletVersionSchema,
        'body'
    ),
    networkValidation: validationMiddleware(schemas.networkSchema, 'params'),
    checkTokenValidation: validationMiddleware(
        schemas.checkTokenSchema,
        'body'
    ),
    checkEVMValidation: validationMiddleware(
        schemas.checkEVMAddressSchema,
        'params'
    ),
    addNewTokenValidation: validationMiddleware(schemas.tokenSchema, 'body'),
    passwordCheckValidation: validationMiddleware(
        schemas.passwordCheckSchema,
        'body'
    ),
    paymentRequestValidation: validationMiddleware(
        schemas.paymentRequestSchema,
        'body'
    ),
    getQuoteValidation: validationMiddleware(schemas.getQuoteSchema, 'body'),
    sendTokenValidation: validationCustomMiddleware(
        schemas.sendTokenSchema,
        schemas.maxSendTokenQuerySchema
    ),
    migrationWalletValidation: validationMiddleware(
        schemas.migrationWalletSchema,
        'body'
    ),
    cryptoListValidation: validationMiddleware(
        schemas.cryptoListSchema,
        'query'
    ),
}
