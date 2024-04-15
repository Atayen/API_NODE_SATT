const { responseHandler } = require('../helpers/response-handler')
const makeResponseData = responseHandler.makeResponseData
const makeResponseError = responseHandler.makeResponseError
const multer = require('multer')
const { ObjectId } = require('mongodb')
var sanitize = require('mongo-sanitize')
const web3 = require('web3')
const { externalUpdateStatforUser } = require('../helpers/common')
const Big = require('big.js')
const upload = multer({ dest: 'uploads/' })
const {
    getWeb3Instance,
    formatTokenBalance,
    getNativeBalance,
} = require('../web3/wallets')

const { generateAccessTokenExternal } = require('../helpers/utils')
const { Constants, TronConstant } = require('../conf/const')
const {
    getInstagramUserName,
    findBountyOracle,
    answerAbos,
    getPromApplyStats,
    getReachLimit,
    getTotalToEarn,
    getReward,
    getButtonStatus,
    answerBounty,
    answerOne,
    limitStats,
    answerCallExternal,
    verifyYoutube,
    verifyInsta,
    verifyFacebook,
    verifyTwitter,
    verifyLinkedin,
    verifytiktok,
    verifyThread,
} = require('../manager/oracles')

const {
    getCampaignContractByHashCampaignExternal,
    getPromContractExternal,
    getCampaignOwnerAddr,
    webTronInstance,
} = require('../blockchainConnexion')
const storageCover = multer.memoryStorage()
const {
    Campaigns,
    GoogleProfile,
    LinkedinProfile,
    TwitterProfile,
    FbPage,
    TikTokProfile,
    UserExternalWallet,
    Request,
    CampaignLink,
    User,
    FbProfile,
} = require('../model/index')
var fs = require('fs')

var rp = require('axios')
const { oauth } = require('../conf/config')
const {
    filterLinks,
    sortOutPublic,
    getLinkedinLinkInfo,
    influencersLinks,
    getTransactionAmountExternal,
} = require('../web3/campaigns')

const { create } = require('ipfs-http-client')
var mongoose = require('mongoose')
const Grid = require('gridfs-stream')

exports.createUserFromExternalWallet = async (req, res) => {
    try {
        var userExist = await UserExternalWallet.findOne({
            walletId: req.body.wallet,
        })
        if (!userExist) {
            const workerId = process.pid
            const currentDate = new Date().getTime()
            const uniqueId = parseInt(workerId + currentDate)
            const user = new UserExternalWallet({
                UserId: uniqueId,
                walletId: req.body.wallet,
            })
            const savedUser = await user.save()
            const token = generateAccessTokenExternal({ _id: savedUser.UserId })
            var params = {
                user: savedUser,
                token,
            }
            return makeResponseData(
                res,
                200,
                'User created successfully',
                params
            )
        }
        //await externalUpdateStatforUser(userExist.UserId)
        else {
            const token = generateAccessTokenExternal({ _id: userExist.UserId })

            var params = {
                user: userExist,
                token,
            }
            return makeResponseData(
                res,
                200,
                'User signed In successfully',
                params
            )
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        userExist &&
            (await externalUpdateStatforUser(
                userExist.UserId,
                userExist.walletId
            ))
    }
}

exports.campaignsPictureUploadExternal = multer({
    storage: storageCover,
}).single('cover')

exports.externalSocialAccounts = async (req, res) => {
    try {
        const _id = req.user._id
        const user = await UserExternalWallet.findOne({ _id })
        let UserId = user.UserId
        let networks = {}
        let [channelsGoogle, channelsTwitter] = await Promise.all([
            GoogleProfile.find({ UserId }, { accessToken: 0, refreshToken: 0 }),
            TwitterProfile.find(
                { UserId },
                { _raw: 0, access_token_key: 0, access_token_secret: 0 }
            ),
        ])
        let channelsFacebook = await FbPage.find({ UserId }, { token: 0 })
        let channelsLinkedin = await LinkedinProfile.find({
            userId: UserId,
        })
        let channelsTiktok = await TikTokProfile.find(
            { userId: UserId },
            { accessToken: 0, refreshToken: 0 }
        )
        networks.google = channelsGoogle
        networks.twitter = channelsTwitter
        networks.facebook = channelsFacebook
        networks.linkedin = channelsLinkedin?.flatMap((item) =>
            item?.pages.map((elem) => {
                elem = elem.toJSON()
                elem.linkedinId = item.linkedinId
                return elem
            })
        )

        networks.tikTok = channelsTiktok || []
        if (
            !channelsGoogle?.length &&
            !channelsLinkedin?.length &&
            !channelsTwitter?.length &&
            !channelsFacebook?.length &&
            !channelsTiktok?.length
        ) {
            return makeResponseError(res, 204, 'No channel found')
        }
        return makeResponseData(res, 200, 'success', networks)
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteTiktokChannel = async (req, res) => {
    try {
        const _id = req.user._id
        const user = await UserExternalWallet.findOne({ _id })

        let tiktokProfiles = await TikTokProfile.find({
            userId: user.UserId,
        })

        if (tiktokProfiles.length === 0)
            return makeResponseError(res, 204, 'No channel found')
        else {
            await TikTokProfile.deleteMany({ userId: user.UserId })
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteTiktokChannels = async (req, res) => {
    try {
        const _id = req.user._id
        const user = await UserExternalWallet.findOne({ _id })

        let tiktokProfiles = await TikTokProfile.find({
            userId: user.UserId,
        })

        if (tiktokProfiles.length === 0)
            return makeResponseError(res, 204, 'No channel found')
        else {
            await TikTokProfile.deleteMany({ userId: user.UserId })
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteGoogleChannel = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        let _id = req.params.id
        let googleProfile = await GoogleProfile.findOne({ _id }).lean()
        if (googleProfile?.UserId !== user.UserId)
            return makeResponseError(res, 401, 'unauthorized')
        else {
            await GoogleProfile.deleteOne({ _id })
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteGoogleChannels = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        const result = await GoogleProfile.deleteMany({
            UserId: user.UserId,
        })
        if (result.deletedCount === 0) {
            return makeResponseError(res, 204, 'No channel found')
        } else {
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteFacebookChannels = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        const result = await FbPage.deleteMany({ UserId: user.UserId })
        if (result.deletedCount === 0) {
            return makeResponseError(res, 204, 'No channel found')
        } else {
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteFacebookChannel = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        let _id = req.params.id
        let facebookProfile = await FbPage.findOne({ _id })
        if (facebookProfile?.UserId !== user.UserId)
            return makeResponseError(res, 401, 'unauthorized')
        else {
            await FbPage.deleteOne({ _id })
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteLinkedinChannels = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        const result = await LinkedinProfile.deleteMany({
            userId: user.UserId,
        })
        if (result.deletedCount === 0) {
            return makeResponseError(res, 204, 'No channel found')
        } else {
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteLinkedinChannel = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        let { linkedinId, organization } = req.params
        let linkedinProfile = await LinkedinProfile.findOne({
            userId: user.UserId,
            linkedinId,
        }).lean()
        if (!linkedinProfile) return makeResponseError(res, 401, 'unauthorized')
        if (linkedinProfile.pages.length === 1) {
            await LinkedinProfile.deleteOne({
                userId: user.UserId,
                linkedinId,
            })
        } else {
            await LinkedinProfile.updateOne(
                { userId: user.UserId, linkedinId },
                { $pull: { pages: { organization } } }
            )
        }
        return makeResponseData(res, 200, 'deleted successfully')
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteTwitterChannels = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        const result = await TwitterProfile.deleteMany({
            UserId: user.UserId,
        })
        if (result.deletedCount === 0) {
            return makeResponseError(res, 204, 'No channel found')
        } else {
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalDeleteTwitterChannel = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        let _id = req.params.id
        let twitterProfile = await TwitterProfile.findOne({ _id })
        if (twitterProfile?.UserId !== user.UserId)
            return makeResponseError(res, 401, 'unauthorized')
        else {
            await TwitterProfile.deleteOne({ _id: twitterProfile._id })
            return makeResponseData(res, 200, 'deleted successfully')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalGetLinks = async (req, res) => {
    try {
        const accountData = req.user.walletId
        const limit = +req.query.limit || 50
        const page = +req.query.page || 1
        const skip = limit * (page - 1)
        let arrayOfLinks = []
        let arrayOfTronLinks = []

        let allProms = []
        let query = filterLinks(req, accountData)
        var count =
            req.query.state === 'owner'
                ? (await CampaignLink.find(
                      { id_campaign: query.id_campaign },
                      { type: { $exists: 0 } }
                  ).countDocuments()) || 0
                : (await CampaignLink.find(
                      { id_wallet: accountData },
                      { type: { $exists: 0 } }
                  ).countDocuments()) || 0
        let tri =
            req.query.state === 'owner'
                ? [
                      [
                          'waiting_for_validation',
                          'harvest',
                          'already_recovered',
                          'not_enough_budget',
                          'no_gains',
                          'indisponible',
                          'rejected',
                          'none',
                      ],
                      '$type',
                  ]
                : [
                      [
                          'harvest',
                          'already_recovered',
                          'waiting_for_validation',
                          'not_enough_budget',
                          'no_gains',
                          'indisponible',
                          'rejected',
                          'none',
                      ],
                      '$type',
                  ]
        let userLinks = await CampaignLink.aggregate([
            {
                $match: query,
            },
            {
                $addFields: {
                    sort: {
                        $indexOfArray: tri,
                    },
                },
            },
            {
                $sort: {
                    sort: 1,
                    appliedDate: -1,
                    _id: 1,
                },
            },
        ])
            .allowDiskUse(true)
            .skip(skip)
            .limit(limit)

        for (let i = 0; i < userLinks.length; i++) {
            let result = userLinks[i]
            let campaign = await Campaigns.findOne(
                { hash: result.id_campaign },
                {
                    fields: {
                        logo: 0,
                        resume: 0,
                        description: 0,
                        tags: 0,
                        cover: 0,
                    },
                }
            )

            if (campaign) {
                let cmp = {}
                const funds = campaign.funds ? campaign.funds[1] : campaign.cost
                ;(cmp._id = campaign._id),
                    (cmp.currency = campaign.token.name),
                    (cmp.title = campaign.title),
                    (cmp.remaining = funds),
                    (cmp.ratio = campaign.ratios),
                    (cmp.bounties = campaign.bounties),
                    (cmp.remuneration = campaign.remuneration),
                    (cmp.endDate = campaign.endDate),
                    (cmp.type = campaign.type)
                result.campaign = cmp
                arrayOfLinks.push(result)
            }
        }
        allProms =
            req.query.campaign && req.query.state
                ? await influencersLinks(arrayOfLinks)
                : arrayOfLinks

        //repeating same process with tron links

        var Links = {
            Links: [...allProms, ...(req.query.state === 'owner' ? [] : [])],
            count,
        }

        return responseHandler.makeResponseData(res, 200, 'success', Links)
    } catch (err) {
        return makeResponseError(
            response,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.externalGetOneLinks = async (req, res) => {
    try {
        const _id = req.body.params

        let link = await CampaignLink.find({ _id })

        return responseHandler.makeResponseData(res, 200, 'success', link)
    } catch (err) {
        return makeResponseError(
            response,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalVerifyLink = async (req, response) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        var userId = user.UserId
        var { typeSN, idUser, idPost } = req.params
        let profileLinedin = null
        if (!typeSN || !idUser || !idPost) {
            return makeResponseError(response, 400, 'please provide all fields')
        }

        var linked = false
        var deactivate = false
        var res = false
        switch (typeSN) {
            case '1':
                let fbProfile = await FbProfile.findOne(
                    { UserId: userId },
                    { accessToken: 1 }
                ).lean()
                let fbPage = await FbPage.findOne(
                    {
                        UserId: userId,
                        username: idUser,
                    },
                    { token: 1, id: 1 }
                ).lean()
                if (fbProfile && fbPage) {
                    linked = true
                    res = await verifyFacebook(idPost, fbPage)

                    if (res && res.deactivate === true) {
                        deactivate = true
                    }
                }
                break
            case '2':
                var googleProfile = await GoogleProfile.findOne(
                    {
                        UserId: userId,
                    },
                    { refreshToken: 1 }
                ).lean()

                if (googleProfile) {
                    const data = await rp.post(
                        'https://oauth2.googleapis.com/token',
                        {
                            client_id: oauth.google.googleClientId,
                            client_secret: oauth.google.googleClientSecret,
                            refresh_token: googleProfile.refreshToken,
                            grant_type: 'refresh_token',
                        }
                    )
                    const access_token = data.data.access_token
                    await GoogleProfile.updateOne(
                        { UserId: userId },
                        { $set: { accessToken: access_token } }
                    )
                    linked = true
                    res = await verifyYoutube(userId, idPost, access_token)
                    if (res && res.deactivate === true) deactivate = true
                }

                break
            case '3':
                var page = await FbPage.findOne({
                    $and: [
                        { UserId: userId },
                        { instagram_id: { $exists: true } },
                    ],
                })
                if (page) {
                    linked = true
                    res = await verifyInsta(userId, idPost)
                    if (res === 'deactivate') deactivate = true
                }

                break
            case '4':
                var twitterProfile = await TwitterProfile.findOne(
                    {
                        UserId: userId,
                    },
                    { access_token_key: 1, access_token_secret: 1 }
                ).lean()
                if (twitterProfile) {
                    linked = true
                    res = await verifyTwitter(twitterProfile, userId, idPost)
                    if (res === 'deactivate') deactivate = true
                }

                break
            case '5':
                var linkedinProfile = await LinkedinProfile.find(
                    { userId },
                    { accessToken: 1, pages: 1, linkedinId: 1 }
                )
                if (linkedinProfile.length) {
                    linked = true
                    for (let profile of linkedinProfile) {
                        res = await verifyLinkedin(profile, idPost)
                        if (res === true) {
                            profileLinedin = profile
                            break
                        }
                        if (res === 'deactivate') deactivate = true
                    }
                }

                break
            case '6':
                var tiktokProfile = await TikTokProfile.findOne({
                    userId,
                }).lean()
                if (tiktokProfile) {
                    linked = true
                    res = await verifytiktok(tiktokProfile, idPost)
                    if (res === 'deactivate') deactivate = true
                }

                break
            case '7':
                var threads = await FbPage.findOne(
                    {
                        UserId: userId,
                        instagram_id: { $exists: true },
                        threads_id: { $exists: true },
                    },
                    { threads_id: 1, instagram_username: 1 }
                ).lean()

                if (threads) {
                    linked = true
                    res = await verifyThread(
                        idPost,
                        threads.threads_id,
                        threads.instagram_username
                    )

                    if (res === 'deactivate') deactivate = true
                }

                break
            default:
        }

        if (!linked)
            return makeResponseError(response, 406, 'account not linked')
        else if (res === 'lien_invalid')
            return makeResponseError(response, 406, 'invalid link')
        else if (deactivate)
            return makeResponseError(response, 405, 'account deactivated')
        else if (res === 'link_not_found')
            return makeResponseError(response, 406, 'link not found')
        else {
            if (typeSN == '7')
                return makeResponseData(
                    response,
                    200,
                    'success',
                    res ? 'true' : 'false',
                    threads.instagram_username
                )
            else
                return makeResponseData(
                    response,
                    200,
                    'success',
                    res ? 'true' : 'false',
                    res === true && typeSN == '5' && profileLinedin?.linkedinId
                )
        }
    } catch (err) {
        return makeResponseError(
            response,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalSaveCampaign = async (req, res) => {
    try {
        let campaign = req.body
        const _id = req.user._id
        const user = await UserExternalWallet.findOne({ _id })
        campaign.idNode = user.UserId
        campaign.createdAt = Date.now()
        campaign.updatedAt = Date.now()
        campaign.type = 'draft'
        let draft = await Campaigns.create(campaign)
        return responseHandler.makeResponseData(res, 200, 'success', draft)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalVerifyExpiredToken = (req, res) => {
    return responseHandler.makeResponseData(res, 200, 'success', true)
}

module.exports.externalAccount = async (req, res) => {
    try {
        if (req.user) {
            let {
                password,
                secureCode,
                secret,
                newEmail,
                fireBaseAccessToken,
                ...user
            } = req.user.toObject()

            return makeResponseData(res, 200, 'success', user)
        } else {
            return makeResponseError(res, 204, 'user not found')
        }
    } catch (err) {
        return makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.extUpdate = async (req, res) => {
    try {
        let campaign = req.body
        campaign.updatedAt = Date.now()
        let updatedCampaign = await Campaigns.findOneAndUpdate(
            { _id: req.params.id, idNode: req.body.userId },
            {
                $set: {
                    values: { ...campaign.values },
                    //   walletId: req.body.walletId,
                },
            },
            { new: true }
        )

        if (updatedCampaign) {
            return responseHandler.makeResponseData(
                res,
                200,
                'updated',
                updatedCampaign
            )
        } else {
            return responseHandler.makeResponseError(
                res,
                204,
                'Campaign not found'
            )
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalUploadPictureToIPFS = async (req, res) => {
    // using IPFS
    try {
        if (req.file) {
            const { id } = '65a90106ceb1f41824a61161'

            // SEARCH COMPAIGN ID
            const campaign = await Campaigns.findOne({
                _id: id,
                idNode: req.body.userId,
            })

            if (campaign) {
                // IPFS CONNECTION
                const ipfs = await ipfsConnect()

                // READ FILE
                const x = fs.readFileSync(req.file.path)

                // ADD TO IPFS
                let buffer = Buffer.from(x)
                let result = await ipfs.add({ content: buffer })

                // REMOVE FILE FROM UPLOADS DIR
                fs.unlinkSync('uploads/' + req.file.filename)

                return responseHandler.makeResponseData(res, 200, result, true)
            } else
                return responseHandler.makeResponseData(
                    res,
                    400,
                    'campaign not found / you are not the owner',
                    false
                )
        } else
            return responseHandler.makeResponseData(
                res,
                400,
                'required picture',
                false
            )
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}
const ipfsConnect = async () => {
    const auth =
        'Basic ' +
        Buffer.from(
            process.env.IPFS_PROJECT_ID + ':' + process.env.IPFS_SECRET_KEY
        ).toString('base64')

    const ipfs = await create({
        host: process.env.IPFS_INFURA,
        port: process.env.IPFS_INFURA_PORT,
        protocol: process.env.IPFS_INFURA_PROTOCOL,
        headers: {
            authorization: auth,
        },
    })
    return ipfs
}

module.exports.externalAddKits = async (req, res) => {
    try {
        let file = req.file // Use singular 'file' instead of 'files'

        let links =
            typeof req.body.link === 'string'
                ? [req.body.link] // Wrap the single link in an array
                : req.body.link

        let idCampaign = ObjectId(req.body.campaign)

        if (file) {
            // Update the single file
            await gfsKit.files.updateOne(
                { _id: file.id },
                {
                    $set: {
                        campaign: {
                            $ref: 'campaign',
                            $id: idCampaign,
                            $db: 'atayen',
                        },
                    },
                }
            )
        }

        if (links) {
            await Promise.all(
                links.map((link) => {
                    return gfsKit.files.insertOne({
                        campaign: {
                            $ref: 'campaign',
                            $id: idCampaign,
                            $db: 'atayen',
                        },
                        link: link,
                    })
                })
            )
        }

        return responseHandler.makeResponseData(res, 200, 'Kit uploaded', false)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}
module.exports.externalApply = async (req, res) => {
    try {
        const user = await UserExternalWallet.findOne({ _id: req.user._id })
        var id = user.UserId
        // var pass = req.body.pass
        var {
            linkedinId,
            idCampaign,
            typeSN,
            idPost,
            idUser,
            title,
            pass,
            linkedinUserId,
            signature,
        } = req.body
        let [prom, date, hash] = [
            {},
            Math.floor(Date.now() / 1000),
            req.body.hash,
        ]
        var campaignDetails = await Campaigns.findOne({ hash }).lean()
        let limit = campaignDetails.limit
        let userWallet = user.walletId
        let numberParticipation = await CampaignLink.find({
            id_campaign: hash,
            id_wallet: userWallet,
        }).count()
        if (limit > 0 && limit === numberParticipation) {
            return responseHandler.makeResponseError(
                res,
                401,
                'Limit participation reached'
            )
        }

        let promExist = await CampaignLink.exists({
            id_campaign: hash,
            idPost,
        })

        if (promExist) {
            return responseHandler.makeResponseError(
                res,
                401,
                'Link already sent'
            )
        }

        req.body.network = campaignDetails.token.type
        if (typeSN == 5) {
            var linkedinProfile = await LinkedinProfile.findOne(
                { userId: id, ...(linkedinId && { linkedinId }) },
                { refreshToken: 1, accessToken: 1 }
            ).lean()
            var linkedinInfo = await getLinkedinLinkInfo(
                linkedinProfile.accessToken,
                linkedinUserId,
                linkedinProfile
            )

            var media_url = linkedinInfo?.mediaUrl || ''
            idUser = linkedinInfo?.idUser
            idPost = linkedinInfo?.idPost.replace(/\D/g, '')
        }

        if (typeSN == 6) {
            var tiktokProfile = await TikTokProfile.findOne({ userId: id })
        }
        if (typeSN == 3)
            prom.instagramUserName = await getInstagramUserName(idPost, id)

        if (typeSN == 7) {
            var threads = await FbPage.findOne(
                {
                    UserId: id,
                    instagram_id: { $exists: true },
                    threads_id: { $exists: true },
                },
                { threads_id: 1, instagram_username: 1 }
            ).lean()
            prom.instagramUserName = threads.instagram_username
        }

        prom.abosNumber = await answerAbos(
            typeSN + '',
            idPost,
            idUser,
            linkedinProfile,
            tiktokProfile,
            id,
            prom.instagramUserName
        )
        const r = req.body.signature.slice(0, 66)
        const s = '0x' + req.body.signature.slice(66, 130)
        const v = '0x' + req.body.signature.slice(130, 132)
        prom.applyerSignature = {}
        prom.applyerSignature.signature = req.body.signature
        prom.applyerSignature.messageHash = req.body.message
        prom.applyerSignature.r = r
        prom.applyerSignature.v = v
        prom.applyerSignature.s = s
        prom.typeSN = typeSN.toString()
        prom.idUser = typeSN === 6 ? user.UserId : idUser
        prom.userExternal = true
        if (media_url) prom.media_url = media_url
        if (prom.typeSN == 5) {
            prom.typeURL = linkedinInfo.idPost.split(':')[2]
            prom.linkedinId = linkedinId
        }
        prom.id_wallet = user.walletId
        prom.idPost = idPost
        prom.id_campaign = hash
        prom.appliedDate = date
        prom.oracle = findBountyOracle(prom.typeSN)
        var insert = await CampaignLink.create(prom)

        let socialOracle = await getPromApplyStats(
            prom.oracle,
            prom,
            id,
            linkedinProfile,
            tiktokProfile
        )

        prom.views = socialOracle?.views || 0
        prom.likes = socialOracle?.likes || 0
        prom.shares = socialOracle?.shares || 0
        prom.media_url = media_url || socialOracle?.media_url

        await Promise.allSettled([
            CampaignLink.updateOne({ _id: insert._id }, { $set: prom }),
            notificationManager(id, 'apply_campaign', {
                cmp_name: title,
                cmp_hash: idCampaign,
                linkId: insert._id,
                network: campaignDetails.token.type,
            }),
        ])

        return responseHandler.makeResponseData(res, 200, 'success', prom)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.checkHarvest = async (req, res) => {
    req.body = sanitize(req.body)
    var idProm = req.body.idProm

    try {
        var link = await CampaignLink.findOne({ id_prom: idProm }).lean()
        var date = Math.floor(Date.now() / 1000)
        if (link.acceptedDate && date - link.acceptedDate <= 86400) {
            return responseHandler.makeResponseError(
                res,
                403,
                "You didn't exceed the limits timing to harvest again"
            )
        } else {
            return responseHandler.makeResponseData(res, 200, 'success')
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalAnswer = async (req, res) => {
    try {
        var tronWeb

        var link = await CampaignLink.findOne({
            id_prom: req.body.idProm,
        }).lean()

        const externalWallet = await UserExternalWallet.findOne({
            walletId: link.id_wallet,
        })
        var ctr
        var gasPrice
        var wrappedTrx = false
        campaignData = await Campaigns.findOne({
            hash: link.id_campaign,
        }).lean()
        var credentials = {
            network: campaignData.token.type,
        }
        var linkedinData =
            link.typeSN == '5' &&
            (await LinkedinProfile.findOne(
                {
                    userId: externalWallet.UserId,
                    ...(link.linkedinId && { linkedinId: link.linkedinId }),
                },
                { accessToken: 1, _id: 0, refreshToken: 1 }
            ).lean())
        if (!!campaignData.bounties.length) {
            if (tronWeb?.BigNumber(prom.amount._hex) > 0 && prom.isPayed) {
                var ret = await getGains(
                    idProm,
                    credentials,
                    tronWeb,
                    campaignData.token.addr
                )
                return responseHandler.makeResponseData(
                    res,
                    200,
                    'success',
                    ret
                )
            }

            let bountie = campaignData.bounties.find(
                (b) => b.oracle == findBountyOracle(prom.typeSN)
            )
            let maxBountieFollowers =
                bountie.categories[bountie.categories.length - 1].maxFollowers
            var evts = await updateBounty(
                idProm,
                credentials,
                tronWeb,
                campaignData.token.type
            )
            stats = link.abosNumber
            if (+stats >= +maxBountieFollowers) {
                stats = (+maxBountieFollowers - 1).toString()
            }

            await Request.updateOne(
                { id: idProm },
                {
                    $set: {
                        nbAbos: stats,
                        isBounty: true,
                        new: false,
                        date: Date.now(),
                        typeSN: prom.typeSN,
                        idPost: prom.idPost,
                        idUser: externalWallet.idUser,
                    },
                },
                { upsert: true }
            )
            try {
                await answerBounty({
                    credentials,
                    tronWeb,
                    gasPrice: gasPrice,
                    from: process.env.CAMPAIGN_OWNER,
                    campaignContract:
                        (!!tronWeb && TronConstant.campaign.address) ||
                        ctr.options.address,
                    idProm: idProm,
                    nbAbos: stats,
                })
            } finally {
                return responseHandler.makeResponseData(res, 200, 'success')
            }
        } else {
            ctr = await getPromContractExternal(req.body.idProm, credentials)
            gasPrice = await ctr.getGasPrice()
        }

        var prevstat = await Request.find({
            new: false,
            typeSN: link.typeSN,
            idPost: link.idPost,
            idUser: externalWallet.UserId,
            idCampaign: link.id_campaign,
        }).sort({ date: -1 })

        if (link.typeSN == '6') {
            var tiktokProfile = await TikTokProfile.findOne({
                userId: externalWallet.UserId,
            })
        }

        const external = true
        stats = await answerOne(
            link.typeSN + '',
            link.idPost + '',
            link.typeSN === 5 || link.typeSN === 1
                ? link.idUser + ''
                : externalWallet.UserId + '',
            link.typeURL,
            linkedinData,
            tiktokProfile,
            link.instagramUserName,
            external
        )
        var copyStats = { ...stats }
        var ratios =
            (!!tronWeb && (await ctr.getRatios(link.id_campaign).call())) ||
            (await ctr.methods.getRatios(link.id_campaign).call())

        var abos = link.abosNumber
        if (stats) stats = limitStats(link.typeSN, stats, ratios, abos, '')
        stats.views = stats?.views || 0
        if (stats.views === 'old') stats.views = link?.views
        stats.shares = stats?.shares || 0
        stats.likes = stats?.likes || 0

        requests = await Request.find({
            new: true,
            isBounty: false,
            typeSN: link.typeSN,
            idPost: link.idPost,
            idUser: externalWallet.UserId,
        })

        if (!requests.length) {
            if (
                !prevstat.length ||
                stats?.likes != prevstat[0]?.likes ||
                stats?.shares != prevstat[0]?.shares ||
                stats?.views != prevstat[0]?.views
            ) {
                requests = await Request.find({
                    new: true,
                    isBounty: false,
                    typeSN: link.typeSN,
                    idPost: link.idPost,
                    idUser: externalWallet.UserId,
                })
                var tronWeb
                var idRequest = req.body.tx[0].topics[1]

                // var idRequest = (!!tronWeb && evt.result.idRequest) || evt.raw.topics[1]
                requests = [{ id: idRequest }]
            }
        }
        if (requests && requests.length) {
            await Request.updateOne(
                { id: idRequest },
                {
                    $set: {
                        id: idRequest,
                        likes: stats.likes,
                        shares: stats.shares,
                        views: stats?.views,
                        new: false,
                        date: Date.now(),
                        typeSN: link.typeSN,
                        idPost: link.idPost,
                        idUser: externalWallet.UserId,
                    },
                },
                { upsert: true }
            )
            let campaignContractOwnerAddr = process.env.CAMPAIGN_OWNER
            await answerCallExternal({
                credentials,
                tronWeb,
                gasPrice: gasPrice,
                from: campaignContractOwnerAddr,
                campaignContract:
                    (!!tronWeb && TronConstant.campaign.address) ||
                    ctr.options.address,
                idRequest: idRequest,
                likes: stats.likes,
                shares: stats?.shares,
                views: stats?.views,
            })
        }

        return responseHandler.makeResponseData(res, 200, 'success', copyStats)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalGains = async (req, res) => {
    try {
        var tronWeb
        await CampaignLink.updateOne(
            { id_prom: req.body.idProm },
            {
                $set: {
                    lastHarvestDate: Math.floor(new Date().getTime() / 1000),
                },
            }
        )
        var link = await CampaignLink.findOne({
            id_prom: req.body.idProm,
        }).lean()

        const externalWallet = await UserExternalWallet.findOne({
            walletId: link.id_wallet,
        })

        campaignData = await Campaigns.findOne({
            hash: link.id_campaign,
        }).lean()
        var credentials = {
            network: campaignData.token.type,
        }

        await User.updateOne(
            { _id: externalWallet.UserId },
            {
                $set: {
                    lastHarvestDate: Date.now(),
                },
            }
        )
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        if (req.body.tx.data) {
            let campaignType = {}
            let amount = await getTransactionAmountExternal(
                credentials,
                campaignData.token.type,
                req.body.tx.hash,
                credentials.network
            )
            let updatedFUnds = { ...req.body.data.data }

            let cmpLink = await CampaignLink.findOne({
                id_prom: req.body.idProm,
            }).lean()
            req.body.bounty && (updatedFUnds.isPayed = true)
            updatedFUnds.payedAmount = !cmpLink.payedAmount
                ? amount
                : new Big(cmpLink.payedAmount).plus(new Big(amount)).toFixed()
            updatedFUnds.type = 'already_recovered'
            await CampaignLink.updateOne(
                { id_prom: req.body.idProm },
                { $set: updatedFUnds }
            )

            let contract = await getCampaignContractByHashCampaignExternal(
                cmpLink.id_campaign,
                credentials,
                tronWeb
            )
            var result =
                (!!tronWeb && (await contract.campaigns('0x' + hash).call())) ||
                (await contract.methods.campaigns(cmpLink.id_campaign).call())

            campaignType.funds = result.funds
            if (result.funds[1] === '0') campaignType.type = 'finished'

            await Campaigns.updateOne(
                { hash: cmpLink.id_campaign },
                { $set: campaignType }
            )
            return responseHandler.makeResponseData(res, 200, 'success')
        }
    }
}

exports.campaigns = async (req, res) => {
    try {
        let strangerDraft = []
        let idWallet =
            req.query.idWallet === 'null'
                ? JSON.parse(req.query.idWallet)
                : req.query.idWallet
        if (idWallet) {
            let user = await UserExternalWallet.findOne({ walletId: idWallet })
            var idNode = user.UserId
            strangerDraft = await Campaigns.distinct('_id', {
                idNode: { $ne: idNode },
                hash: { $exists: false },
            })
        }
        let limit = +req.query.limit || 10
        let page = +req.query.page || 1
        //let skip = limit * (page - 1)
        let skip = 1 * (page - 1)
        let query = sortOutPublic(req, idNode, strangerDraft)

        let count = await Campaigns.countDocuments()
        let tri = [['draft', 'apply', 'inProgress', 'finished'], '$type']
        let campaigns = await Campaigns.aggregate([
            {
                $match: query,
            },
            {
                $addFields: {
                    sortPriority: { $eq: ['$idNode', idNode] },
                    sort: {
                        $indexOfArray: tri,
                    },
                },
            },
            {
                $sort: {
                    sort: 1,
                    sortPriority: -1,
                    launchDate: -1,
                    _id: 1,
                },
            },
            {
                $project: {
                    coverSrc: 0,
                    description: 0,
                    logo: 0,
                    tags: 0,
                    dataUrl: 0,
                    countries: 0,
                    resume: 0,
                },
            },
        ])
            .allowDiskUse(true)
            .skip(skip)
            .limit(1)

        return responseHandler.makeResponseData(res, 200, 'success', {
            campaigns,
            count,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.getBalanceUserExternal = async (req, res) => {
    try {
        const { network, walletAddress, smartContract, isNative } = req.body

        // Initialize the appropriate Web3 instance based on the network
        const web3Instance = await getWeb3Instance(network)

        if (!isNative) {
            const contract = new web3Instance.eth.Contract(
                Constants.token.abi,
                smartContract
            )
            const [balance, decimals] = await Promise.all([
                contract.methods.balanceOf(walletAddress).call(),
                contract.methods.decimals().call(),
            ])
            const balanceFormatted = formatTokenBalance(balance, decimals)
            return responseHandler.makeResponseData(
                res,
                200,
                'success',
                balanceFormatted
            )
        } else {
            const balance = await getNativeBalance(
                web3Instance,
                walletAddress,
                network
            )
            return responseHandler.makeResponseData(
                res,
                200,
                'success',
                balance
            )
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.externalDeleteDraft = async (req, res) => {
    try {
        let user = await UserExternalWallet.findOne({
            _id: req.user._id,
        })
        let _id = req.params.id
        let idUser = user.UserId
        let campaign = await Campaigns.findOne({ _id })
        if (
            campaign.idNode !== idUser.toString() ||
            campaign.type !== 'draft'
        ) {
            return responseHandler.makeResponseError(res, 401, 'unauthorized')
        } else {
            await Campaigns.deleteOne({ _id })
            return responseHandler.makeResponseData(
                res,
                200,
                'deleted successfully',
                false
            )
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}
