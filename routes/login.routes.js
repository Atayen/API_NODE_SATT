var express = require('express')
var app = express()

const passport = require('passport')
let router = express.Router()
router.use(passport.initialize())
var session = require('express-session')
var GoogleStrategy = require('passport-google-oauth20').Strategy
const TwitterStrategy = require('passport-twitter').Strategy
var FbStrategy = require('passport-facebook').Strategy
var TelegramStrategy = require('passport-telegram-official').TelegramStrategy

var OAuth2Strategy = require('passport-oauth2').Strategy
var passOAuth = require('passport-oauth2')

var Long = require('mongodb').Long
const { User } = require('../model/index')

//const { User } = require('../model/user.model')

passport.serializeUser(function (user, cb) {
    cb(null, user)
})

passport.deserializeUser(async function (id, cb) {
    var users = await User.find({ _id: Long.fromNumber(id) })
    cb(null, users[0])
})
try {
    router.use(
        session({
            secret: 'fe3fF4FFGTSCSHT57UI8I8',
            resave: true,
            saveUninitialized: true,
        })
    )
    router.use(passport.session())
} catch (e) {
    console.log(e)
}
const {
    walletConnection,
    changePassword,
    socialdisconnect,
    captcha,
    verifyCaptcha,
    codeRecover,
    confirmCode,
    passRecover,
    resendConfirmationToken,
    saveFirebaseAccessToken,
    updateLastStep,
    authApple,
    socialSignUp,
    socialSignin,
    getQrCode,
    verifyQrCode,
    purgeAccount,
    logout,
    getToken,
    setVisitSignUpStep,
    signupRequest,
} = require('../controllers/login.controller')
const {
    emailConnection,
    telegramConnection,
    emailSignup,
    telegramSignup,
    googleAuthSignup,
    facebookAuthSignup,
    googleAuthSignin,
    facebookAuthSignin,
    signup_telegram_function,
    signin_telegram_function,
    verifyAuth,
    sattConnect,
    twitterAuthSignup,
    twitterAuthSignin,
} = require('../middleware/passport.middleware')
const {
    persmissionsObjFb,
    facebookCredentials,
    googleCredentials,
} = require('../conf/config')
const { profile } = require('winston')

function authSignInErrorHandler(err, req, res, next) {
    let message = err.message ? err.message : err
    res.redirect(process.env.BASED_URL + '/auth/login?message=' + message)
}

function authErrorHandler(err, req, res, next) {
    let message = err.message ? err.message : err
    res.redirect(
        process.env.BASED_URL + '/auth/registration?message=' + message
    )
}

/**
 * @swagger
 * /auth/captcha:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: get random captcha .
 *     description: return captcha to user to allow authentication action <br> without access_token
 *     produces:
 *       - application/json
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{_id,originalImage,puzzle,position}
 *       "500":
 *          description: code,<br>error:"error"
 */
router.get('/captcha', captcha)

/**
 * @swagger
 * /auth/verifyCaptcha:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: check if valid captcha .
 *     description: Check captcha to verify that you are not a bot <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               position:
 *                 type: number
 *     responses:
 *       "200":
 *          description: code,<br>message:"success"
 *       "401":
 *          description: code,<br>error:"wrong captcha"
 *       "500":
 *          description: code,<br>error:"error"
 */
router.post('/verifyCaptcha', verifyCaptcha)

/**
 * @swagger
 * /auth/purge:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: purge Account .
 *     description: return captcha to user to allow authentication action <br> without access_token
 *     produces:
 *       - application/json
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message:"account deleted"
 *       "401":
 *          description: code,<br>message:"wrong password"
 *       "500":
 *          description: code,<br>error
 */
router.post('/purge', verifyAuth, purgeAccount)

/**
 * @swagger
 * /auth/changePassword:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: change password .
 *     description: user set his old and new password, system check if user and password are matched or not <br> with access_token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               newpass:
 *                 type: string
 *               oldpass:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message:"changed"
 *       "401":
 *          description: code,<br>error:"wrong password"
 *       "204":
 *          description: error:"no account"
 *       "500":
 *          description: error:"error"
 */
router.post('/changePassword', verifyAuth, changePassword)
/**
 * @swagger
 * /auth/signin/mail:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: check if email & password are correct.
 *     description: Check credentials and return access token <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user "}
 *       "401":
 *          description: code,<br>error
 *       "500":
 *          description: error=eror
 */
router.post('/signin/mail', emailConnection)

/**
 * @swagger
 * /auth/walletconnect:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: signin using WalletConnect.
 *     description: Check if wallet address is exist and return access token <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user "}
 *       "401":
 *          description: code,<br>error
 *       "500":
 *          description: error=eror
 */
router.post('/walletconnect', walletConnection)

/**
 * @swagger
 * /auth/passlost:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: get code to recover password.
 *     description: Send verification code to requested email <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               mail:
 *                 type: string
 *               lang:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message="Email was sent to email"
 *       "401":
 *          description: code,<br>error:"account_locked"
 *       "204":
 *          description: code,<br>error:"account not exists"
 *       "500":
 *          description: error=eror
 */
router.post('/passlost', codeRecover)

router.get('/getToken/:id', getToken)

/**
 * @swagger
 * /auth/confirmCode:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: check if code correct.
 *     description: check if verification code is correct <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               email:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message:"code_is_matched"
 *       "204":
 *          description: code,<br>error"user not found"
 *       "401":
 *          description: code,error
 *       "500":
 *          description: error=eror
 */
router.post('/confirmCode', confirmCode)

/**
 * @swagger
 * /auth/passrecover:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: change password.
 *     description: user change his password, system check if email and access_token are matched or not <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               newpass:
 *                 type: string

 *     responses:
 *       "200":
 *          description: code,<br>message:successfully
 *       "204":
 *          description: code,<br>error"user not found"
 *       "401":
 *          description: code,error
 *       "500":
 *          description: error=eror
 */
router.post('/passrecover', passRecover)

/**
 * @swagger
 * /auth/signup/mail:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: signup with email and password.
 *     description: user enter his credentials to create a new account, system check if email exist or not <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               lang:
 *                 type: string
 *               newsLetter:
 *                 type: boolean
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 *       "401":
 *          description: code,<br>error:{error:true,message:'account_already_used'}
 *       "500":
 *          description: error=eror
 */
router.post('/signup/mail', emailSignup)

/**
 * @swagger
 * /auth/signup/facebook:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signup with facebook.
 *     description: user asked for signup with facebook, system redirect him to signup facebook page <br> without access_token.
 *     responses:
 *       "redirection":
 *          description: param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signup/facebook', async (req, res, next) => {
    passport.authenticate('auth_signup_facebookStrategy', persmissionsObjFb)(
        req,
        res,
        next
    )
})

passport.use(
    'auth_signup_facebookStrategy',
    new FbStrategy(
        facebookCredentials('auth/callback/facebook/signup'),
        async (req, accessToken, refreshToken, profile, cb) => {
            facebookAuthSignup(req, accessToken, refreshToken, profile, cb)
        }
    )
)

/**
 * @swagger
 * /auth/signup/twitter:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signup with twitter.
 *     description: user asked for signup with twitter, system redirect him to signup twitter page <br> without access_token.
 *     responses:
 *       "redirection":
 *          description: param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signup/twitter', async (req, res, next) => {
    passport.authenticate('twitter')(req, res, next)
})

passport.use(
    new TwitterStrategy(
        {
            consumerKey: process.env.TWITTER_CONSUMER_KEY,
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: process.env.BASEURL + 'auth/twitter/callback',
            profileFields: ['id', 'displayName', 'photos', 'email'],
            includeEmail: true,
        },
        async (req, accessToken, refreshToken, profile, cb) => {
            console.log(' profile tiwtter signup', profile)
            twitterAuthSignup(req, accessToken, refreshToken, profile, cb)
        }
    )
)

passport.use(
    new OAuth2Strategy(
        {
            authorizationURL: 'https://twitter.com/i/oauth2/authorize',
            tokenURL: 'https://api.twitter.com/2/oauth2/token',
            clientID: process.env.TWITTER_CONSUMER_KEY,
            clientSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: process.env.BASEURL + '/auth/twitter/signin/callback',
        },
        async (req, accessToken, refreshToken, profile, cb) => {
            console.log(' profile tiwtter signup', profile)
            twitterAuthSignin(req, accessToken, refreshToken, profile, cb)
        }
    )
)

router.get('/auth/twitterLogin', passport.authenticate('oauth2'))

router.get(
    '/twitter/signin/callback',
    passport.authenticate('oauth2', {
        failureRedirect: '/',
        scope: ['tweet.read', 'tweet.write', 'users.read'],
    }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect(process.env.BASED_URL + '/auth/login')
    }
)

router.get('/auth/twitter', passport.authenticate('twitter'))

router.get(
    '/twitter/callback',
    passport.authenticate('twitter', {
        failureRedirect: '/login',
        scope: ['tweet.read', 'tweet.write', 'users.read'],
    }),

    function (req, res) {
        console.log('im sucess')
        // Successful authentication, redirect home.
        res.redirect(process.env.BASED_URL + '/auth/login')
    }
)
router.get(
    '/callback/facebook/signup',
    passport.authenticate('auth_signup_facebookStrategy'),
    async function (req, response) {
        try {
            var param = {
                access_token: req.user.token,
                expires_in: req.user.expires_in,
                token_type: 'bearer',
                scope: 'user',
            }
            response.redirect(
                process.env.BASED_URL +
                    '/auth/login?token=' +
                    JSON.stringify(param)
            )
        } catch (e) {}
    },
    authErrorHandler
)

//start signin twitter

/**
 * @swagger
 * /auth/signin/twitter:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signin with twitter.
 *     description: user asked for signin with twitter, system redirect him to signin twitter page <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signin/twitter', async (req, res, next) => {
    passport.authenticate('twitter-signin')(req, res, next)
})

passport.use(
    'twitter-signin',
    new TwitterStrategy(
        {
            consumerKey: process.env.TWITTER_CONSUMER_KEY,
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: process.env.BASEURL + '/auth/twitter/signin/callback',
            profileFields: ['id', 'displayName', 'photos', 'email'],
            includeEmail: true,
        },
        async function (req, accessToken, refreshToken, profile, cb) {
            twitterAuthSignin(req, accessToken, refreshToken, profile, cb)
        }
    )
)
router.get(
    '/twitter/signin/callback',
    passport.authenticate('twitter-signin'),
    async function (req, response) {
        try {
            var param = {
                access_token: req.user.token,
                expires_in: req.user.expires_in,
                token_type: 'bearer',
                scope: 'user',
            }
            response.redirect(
                process.env.BASED_URL +
                    '/auth/login?token=' +
                    JSON.stringify(param)
            )
        } catch (e) {}
    },
    authSignInErrorHandler
)
//end twitter

/**
 * @swagger
 * /auth/signin/facebook:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signin with facebook.
 *     description: user asked for signin with facebook, system redirect him to signin facebook page <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signin/facebook', async (req, res, next) => {
    passport.authenticate('facebook_strategy_connection')(req, res, next)
})

passport.use(
    'facebook_strategy_connection',
    new FbStrategy(
        facebookCredentials('auth/callback/facebook/connection'),
        async function (req, accessToken, refreshToken, profile, cb) {
            facebookAuthSignin(req, accessToken, refreshToken, profile, cb)
        }
    )
)
router.get(
    '/callback/facebook/connection',
    passport.authenticate('facebook_strategy_connection'),
    async function (req, response) {
        try {
            var param = {
                access_token: req.user.token,
                expires_in: req.user.expires_in,
                token_type: 'bearer',
                scope: 'user',
            }
            response.redirect(
                process.env.BASED_URL +
                    '/auth/login?token=' +
                    JSON.stringify(param)
            )
        } catch (e) {}
    },
    authSignInErrorHandler
)

/**
 * @swagger
 * /auth/signup/google:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signup with google.
 *     description: user asked for signup with google, system redirect him to signup google page <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signup/google', async (req, res, next) => {
    passport.authenticate('auth_signup_googleStrategy', {
        scope: ['profile', 'email'],
    })(req, res, next)
})

passport.use(
    'auth_signup_googleStrategy',
    new GoogleStrategy(
        googleCredentials('auth/callback/google/signup'),
        async (req, accessToken, refreshToken, profile, cb) => {
            googleAuthSignup(req, accessToken, refreshToken, profile, cb)
        }
    )
)
router.get(
    '/callback/google/signup',
    passport.authenticate('auth_signup_googleStrategy', {
        scope: ['profile', 'email'],
    }),
    async (req, response) => {
        var param = {
            access_token: req.user.token,
            expires_in: req.user.expires_in,
            token_type: 'bearer',
            scope: 'user',
        }
        response.redirect(
            process.env.BASED_URL + '/auth/login?token=' + JSON.stringify(param)
        )
    },
    authErrorHandler
)

/**
 * @swagger
 * /auth/signin/google:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signin with google.
 *     description: user asked for signin with google, system redirect him to signin google page <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get('/signin/google', async (req, res, next) => {
    passport.authenticate('google_strategy_connection', {
        scope: ['profile', 'email'],
    })(req, res, next)
})

passport.use(
    'google_strategy_connection',
    new GoogleStrategy(
        googleCredentials('auth/callback/google/connection'),
        async (req, accessToken, refreshToken, profile, cb) => {
            googleAuthSignin(req, accessToken, refreshToken, profile, cb)
        }
    )
)

router.get(
    '/callback/google/connection',
    passport.authenticate('google_strategy_connection', {
        scope: ['profile', 'email'],
    }),
    async function (req, response) {
        var param = {
            access_token: req.user.token,
            expires_in: req.user.expires_in,
            token_type: 'bearer',
            scope: 'user',
        }
        response.redirect(
            process.env.BASED_URL + '/auth/login?token=' + JSON.stringify(param)
        )
    },
    authSignInErrorHandler
)

/**
 * @swagger
 * /auth/signup/telegram:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signup with telegram.
 *     description: user asked for signup with telegram, system show modal interface of telegram signup <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get(
    '/signup/telegram',
    passport.authenticate('auth_signup_telegramStrategy'),
    telegramSignup,
    authErrorHandler
)
passport.use(
    'auth_signup_telegramStrategy',
    new TelegramStrategy(
        {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            passReqToCallback: true,
        },
        async function (req, profile, cb) {
            signup_telegram_function(req, profile, cb)
        }
    )
)

/**
 * @swagger
 * /auth/signin/telegram:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: signin with telegram.
 *     description: user asked for signin with telegram, system show modal interface of telegram signup <br> without access_token.
 *     responses:
 *       "200":
 *          description: redirection:param={"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 */
router.get(
    '/signin/telegram',
    passport.authenticate('telegramStrategyConnection'),
    telegramConnection,
    authSignInErrorHandler
)
passport.use(
    'telegramStrategyConnection',
    new TelegramStrategy(
        {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            passReqToCallback: true,
        },
        async function (req, profile, cb) {
            signin_telegram_function(req, profile, cb)
        }
    )
)

/**
 * @swagger
 * /auth/resend/confirmationToken:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: resend confirmation code.
 *     description: user enter his email, system check if email exist and will generate new code without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               lang:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,message:"Email sent"
 *       "204":
 *          description: code,error:"user not found"
 *       "500":
 *          description: error=eror
 */
router.post('/resend/confirmationToken', resendConfirmationToken)

/**
 * @swagger
 * /auth/save/firebaseAccessToken:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: save firebase access token.
 *     description: system allow user to save his firebase token to use notification .
 *     parameters:
 *       - name: fireBase
 *         description: fireBase device required for mobile user should send "mobile"
 *         in: query
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               fb_accesstoken:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,message:"success"
 *       "500":
 *          description: error:error message
 */
router.post('/save/firebaseAccessToken', verifyAuth, saveFirebaseAccessToken)

/**
 * @swagger
 * /auth/updateLastStep:
 *   put:
 *     tags:
 *     - "auth"
 *     summary: update last step.
 *     description: system redirect user to page complete profile to verify his information and confirm his email .
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               completed:
 *                 type: boolean
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message
 *       "401":
 *          description: code,<br>error:"email already exists"
 *       "500":
 *          description: error
 */
router.put('/updateLastStep', verifyAuth, updateLastStep)

/**
 * @swagger
 * /auth/apple:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: auth for apple.
 *     description: user enter his credentials to login , system check if email exist or not <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               id_apple:
 *                 type: string
 *               mail:
 *                 type: string
 *               idSN:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 *       "401":
 *          description: code,<br>error:"account_exists_with_another_courrier"
 *       "500":
 *          description: error
 */
router.post('/apple', authApple)

/**
 * @swagger
 * /auth/socialSignup:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: register with social for apple.
 *     description: user enter his credentials to register , system check if email exist or not <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               lang:
 *                 type: string
 *               idSn:
 *                 type: number
 *               id:
 *                 type: string
 *               photo:
 *                 type: string
 *               givenName:
 *                 type: string
 *               familyName:
 *                 type: string
 *               newsLetter:
 *                 type: boolean
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","scope":"user"}
 *       "401":
 *          description: code,<br>message:"account_exists"
 *       "500":
 *          description: error
 */
router.post('/socialSignup', socialSignUp)

/**
 * @swagger
 * /auth/socialSignin:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: auth with social for apple.
 *     description: user enter his credentials to login , system check if id exist or not <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               idSn:
 *                 type: number
 *               id:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>param:{"access_token":token,"expires_in":date,"token_type":"bearer","scope":"user"}
 *       "401":
 *          description: code,<br>message
 *       "500":
 *          description: error
 */
router.post('/socialSignin', socialSignin)

/**
 * @swagger
 * /auth/disconnect/{social}:
 *   put:
 *     tags:
 *     - "auth"
 *     summary: disconnect social account.
 *     description: user enter his social network to disconnect <br> with access_token.
 *     parameters:
 *       - name: social
 *         description: social can be facebook , google or telegram.
 *         in: path
 *         required: true
 *     responses:
 *       "200":
 *          description: message:"deconnect successfully from
 *       "500":
 *          description: error:"error"
 */
router.put('/disconnect/:social', verifyAuth, socialdisconnect)

/**
 * @swagger
 * /auth/disconnect/{social}:
 *   put:
 *     tags:
 *     - "auth"
 *     summary: disconnect social account.
 *     description: user enter his social network to disconnect <br> with access_token.
 *     parameters:
 *       - name: social
 *         description: social can be facebook , google or telegram.
 *         in: path
 *         required: true
 *     responses:
 *       "200":
 *          description: code,<br>message:"deconnect successfully from social
 *       "500":
 *          description: error
 */
router.put('/disconnect/:social', verifyAuth, socialdisconnect)

/**
 * @swagger
 * /auth/qrCode:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: setting two factor authentication for user.
 *     description: user can activate the 2fa.
 *     responses:
 *        "200":
 *          description: code,<br>message,<br>data:"image base 64"
 *        "500":
 *          description: error
 */
router.get('/qrCode', verifyAuth, getQrCode)

/**
 * @swagger
 * /auth/verifyQrCode:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: verify 2fa.
 *     description: user enter his code to login , system check if code is valid or not <br> with access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,message,data:{ verifiedCode:verified(true/false) }
 *       "500":
 *          description: error
 */
router.post('/verifyQrCode', verifyAuth, verifyQrCode)

/**
 * @swagger
 * /auth/logout:
 *   get:
 *     tags:
 *     - "auth"
 *     summary: logout.
 *     description: logout.
 *     responses:
 *       "200":
 *          description: code,message
 *       "500":
 *          description: error
 */
router.get('/logout', verifyAuth, logout)

/**
 * @swagger
 * /auth/satt-connect:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: check if credentials are correct.
 *     description: Check credentials and return wallet address and access token  <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","address":"address",scope":"user "}
 *       "401":
 *          description: code,<br>error
 *       "500":
 *          description: error=eror
 */
router.post('/satt-connect', sattConnect)

/**
 * @swagger
 * /auth/setVisitSignUpStep:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: set visited sign up step the user last visited.
 *     description: set visited sign up step the user last visited  <br> without access_token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               visitedStep:
 *                 type: string
 *     responses:
 *       "200":
 *          description: code,<br>message,<br>data:{"access_token":token,"expires_in":expires_in,"token_type":"bearer","address":"address",scope":"user "}
 *       "401":
 *          description: code,<br>error
 *       "500":
 *          description: error=eror
 */
router.post('/setVisitSignUpStep', setVisitSignUpStep)

/**
 * @swagger
 * /auth/email/signup:
 *   post:
 *     tags:
 *     - "auth"
 *     summary: Signup Request .
 *     description: send signup request if user doesn't have a satt account.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:      # Request body contents
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       "200":
 *          description: Email was sent, {"code":"status code","message":"Email was sent"}
 *       "400":
 *          description: error:<br> please provide a valid email address!
 *       "406":
 *          description: error:<br> Account already exist
 *       "500":
 *          description: error:<br> server error
 */
router.post('/email/signup', signupRequest)

module.exports = router
