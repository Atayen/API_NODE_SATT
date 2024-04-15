var requirement = require('../helpers/utils')
var { readHTMLFileCampaign } = requirement
var sanitize = require('mongo-sanitize')
const multer = require('multer')
const { utils } = require('ethers')
const Big = require('big.js')
const web3 = require('web3')
const etherInWei = new Big(1000000000000000000)
const Grid = require('gridfs-stream')
const GridFsStorage = require('multer-gridfs-storage')
const { create } = require('ipfs-http-client')
var mongoose = require('mongoose')
var fs = require('fs')
const axios = require('axios')
const { CampaignConstants, ArtheraNetworkConstant } = require('../conf/const')

const cron = require('node-cron')
//const ipfs = IPFS('ipfs.infura.io', '5001', {protocol: 'https'})
const {
    Campaigns,
    CampaignLink,
    LinkedinProfile,
    TikTokProfile,
    Wallet,
    Event,
    Request,
    User,
    FbPage,
    UserExternalWallet,
} = require('../model/index')

const { responseHandler } = require('../helpers/response-handler')
const { notificationManager, getDecimal } = require('../manager/accounts')
const { configureTranslation, timeout } = require('../helpers/utils')
const {
    getPrices,
    getAccount,
    getWalletTron,
    getAccountV2,
    unlockV2,
} = require('../web3/wallets')
const {
    fundCampaign,
    getTransactionAmount,
    unlockPolygon,
    polygonAllow,
    lockPolygon,
    tronApprove,
    tronAllowance,
    unlockNetwork,
    approve,
    allow,
    lockNetwork,
    artheraApprove,
    unlockArthera,
} = require('../web3/campaigns')

const { unlock } = require('../web3/wallets')

const { v4: uuidv4 } = require('uuid')
const { mongoConnection, basicAtt } = require('../conf/config')

const {
    createPerformanceCampaign,
    lock,
    unlockBsc,

    bep20Allow,
    lockBSC,
    bep20Approve,
    polygonApprove,
    bttApprove,
    bttAllow,
    artheraAllow,
    lockERC20,
    erc20Allow,
    erc20Approve,
    createBountiesCampaign,
    sortOutPublic,
    getUserIdByWallet,
    getLinkedinLinkInfo,
    getRemainingFunds,
    validateProm,
    filterLinks,
    influencersLinks,
    getGains,
    updateBounty,
    updatePromStats,
} = require('../web3/campaigns')

const {
    getCampaignContractByHashCampaign,
    getPromContract,
    getCampaignOwnerAddr,
    webTronInstance,
} = require('../blockchainConnexion')

const {
    getWeb3Connection,
    networkProviders,
    networkProvidersOptions,
} = require('../web3/web3-connection')
const { automaticRjectLink, BalanceUsersStats } = require('../helpers/common')

cron.schedule(process.env.CRON_UPDATE_STAT, () =>
    /*updateStat(),*/
    automaticRjectLink()
)

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

const calcSNStat = (objNw, link) => {
    objNw.total++
    if (link.status !== 'rejected') {
        const fields = ['views', 'likes', 'shares']
        fields.forEach((field) => {
            link[field] && (objNw[field] += Number(link[field]))
        })
        ;(link.status === true && objNw.accepted++) || objNw.pending++
    } else {
        objNw.rejected++
    }

    return objNw
}

let initStat = () => {
    return {
        total: 0,
        views: 0,
        likes: 0,
        shares: 0,
        accepted: 0,
        pending: 0,
        rejected: 0,
    }
}

var BN = require('bn.js')
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
    answerCall,
} = require('../manager/oracles')
const { updateStat } = require('../helpers/common')
const sharp = require('sharp')
const { ObjectId } = require('mongodb')
const { Constants, TronConstant, wrapConstants } = require('../conf/const')
const { BigNumber } = require('ethers')
const { token } = require('morgan')
const { request } = require('http')
const { URL } = require('url')
const { http, https } = require('follow-redirects')
const verifySignature = require('../web3/verifySignature')

//const conn = mongoose.createConnection(mongoConnection().mongoURI)
let gfsKit
const promise = mongoose.connect(mongoConnection(), {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: true,
})

const conn = mongoose.connection
conn.once('open', () => {
    gfsKit = Grid(conn.db, mongoose.mongo)
    gfsKit.collection('campaign_kit')
})

const storage = new GridFsStorage({
    db: promise,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = uuidv4()
            const fileInfo = {
                filename: filename,
                bucketName: 'campaign_kit',
            }
            resolve(fileInfo)
        })
    },
})

async function fetchCampaign(query) {
    return await Campaigns.findOne(query, {
        logo: 0,
        resume: 0,
        description: 0,
        tags: 0,
        cover: 0,
    }).lean()
}

exports.swapTrx = async (req, res) => {
    try {
        let privateKey = req.body.privateKey
        let amount = req.body.amount
        let tronWeb = await webTronInstance()
        tronWeb.setPrivateKey(privateKey)
        let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
        tronWeb.setAddress(walletAddr)
        let result = await wrappedtrx(tronWeb, amount)
        return responseHandler.makeResponseData(res, 200, 'success', result)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

async function wrappedtrx(webTron, amount) {
    try {
        let ctr = await webTron.contract(
            TronConstant.token.wtrxAbi,
            TronConstant.token.wtrx
        )

        var ret = await ctr.deposit().send({
            feeLimit: 100_000_000,
            callValue: +amount,
            shouldPollResponse: false,
        })

        await timeout(10000)
        let result = await webTron.trx.getTransaction(ret)
        if (result.ret[0].contractRet === 'SUCCESS') {
            return {
                transactionHash: ret,
            }
        } else {
            res.status(500).send({
                code: 500,
                error: 'cannot swap trx coins',
            })
        }

        return ret
    } catch (error) {}
}
const storageCover = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(
            null,
            new Date().toISOString().replace(/:/g, '-') + file.originalname
        )
    },
})

module.exports.upload = multer({ storage }).array('file')

module.exports.campaignsPictureUpload = multer({
    storage: storageCover,
}).single('cover')

module.exports.launchCampaign = async (req, res) => {
    var {
        limit,
        contract,
        ratios,
        amount,
        tokenAddress,
        endDate,
        startDate,
        dataUrl,
    } = req.body
    let { idCampaign: _id, currency, network } = req.body

    try {
        var tronWeb
        var cred
        if (network === 'TRON') {
            let privateKey = (
                await getWalletTron(
                    req.user._id,
                    req.body.pass,
                    req.body.version
                )
            ).priv
            tronWeb = await webTronInstance()
            tronWeb.setPrivateKey(privateKey)
            var walletAddr = tronWeb.address.fromPrivateKey(privateKey)
            tronWeb.setAddress(walletAddr)

            if (tokenAddress === TronConstant.token.wtrx) {
                await wrappedtrx(tronWeb, amount)
            }
        } else {
            cred =
                network === 'ARTHERA'
                    ? await unlockArthera(req, res)
                    : await unlockV2(req, res)

            if (!cred) return
        }
        var ret = await createPerformanceCampaign(
            dataUrl,
            startDate,
            endDate,
            ratios,
            tokenAddress,
            amount,
            cred,
            tronWeb,
            res,
            limit,
            network
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        if (ret?.hash) {
            if (currency.includes('SATT')) {
                amount = (amount * 95) / 100
            } else {
                amount = (amount * 85) / 100
            }
            !!cred && lock(cred)
            var campaign = {
                hash: ret.hash,
                transactionHash: ret.transactionHash,
                startDate,
                endDate,
                limit,
                token: {
                    name: currency,
                    type: network,
                    addr: tokenAddress,
                },
                coverSrc: null,
                dataUrl,
                funds: [
                    (!!tronWeb && TronConstant.campaign.address) || contract,
                    amount,
                ],
                contract: (
                    (!!tronWeb && TronConstant.campaign.address) ||
                    contract
                ).toLowerCase(),
                walletId: (!!tronWeb && walletAddr) || cred.address,
                type: 'inProgress',
                cost: amount,
            }
            let campaignData = await Campaigns.findOne({ _id })
            campaign.cost_usd =
                (tokenAddress == Constants.bep20.address.sattBep20 &&
                    campaignData.cost_usd * 0.95) ||
                campaignData.cost_usd * 0.85
            await Campaigns.updateOne({ _id }, { $set: campaign })
            let event = {
                id: ret.hash,
                type: 'modified',
                date: Math.floor(Date.now() / 1000),
                txhash: ret.transactionHash,
                contract: contract.toLowerCase(),
            }
            await Promise.allSettled([
                Event.create(event),
                notificationManager(req.user._id, 'create_campaign', {
                    cmp: campaign,
                }),
            ])
        }
    }
}

module.exports.launchCampaignExt = async (req, res) => {
    let { idCampaign: _id, currency } = req.body.campagne

    try {
        const _id = req.body.campagne._id

        const contract = req.body.result.to

        if (req.body.campagne.token.name.includes('SATT')) {
            amount = (req.body.campagne.cost * 95) / 100
        } else {
            amount = (req.body.campagne.cost * 85) / 100
        }
        var campaign = {
            hash: req.body.campagne.hash,
            transactionHash: req.body.result.hash,
            startDate: req.body.campagne.startDate,
            endDate: req.body.campagne.endDate,
            limit: req.body.campagne.limit,
            token: {
                name: req.body.campagne.token.name,
                type: req.body.campagne.token.type,
                addr: req.body.campagne.token.addr,
            },
            coverSrc: req.body.campagne.coverSrc,
            dataUrl:
                'https://ropsten.etherscan.io/token/0x2bef0d7531f0aae08adc26a0442ba8d0516590d0',
            funds: [contract, req.body.campagne.cost],
            contract: contract.toLowerCase(),
            walletId: req.body.campagne.walletId,
            type: 'inProgress',
            cost: req.body.campagne.cost,
        }

        campaign.cost_usd =
            (req.body.campagne.token.addr ==
                Constants.bep20.address.sattBep20 &&
                req.body.campagne.cost_usd * 0.95) ||
            req.body.campagne.cost_usd * 0.85
        const updatedArray = { ...req.body.campagne, ...campaign }
        await Campaigns.updateOne({ _id }, { $set: updatedArray })

        let event = {
            id: req.body.campagne.hash,
            type: 'modified',
            date: Math.floor(Date.now() / 1000),
            txhash: req.body.result.hash,
            contract: contract.toLowerCase(),
        }

        return responseHandler.makeResponseData(res, 200, 'success', event)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.launchBounty = async (req, res) => {
    let [_id, contract] = [req.body.idCampaign, req.body.contract.toLowerCase()]
    var { limit, bounties, amount, tokenAddress, endDate, startDate, dataUrl } =
        req.body
    let { network, currency } = req.body
    let id = req.user._id

    try {
        var tronWeb
        var cred
        if (network === 'TRON') {
            let privateKey = (
                await getWalletTron(id, req.body.pass, req.body.version)
            ).priv
            tronWeb = await webTronInstance()
            tronWeb.setPrivateKey(privateKey)
            var walletAddr = tronWeb.address.fromPrivateKey(privateKey)
            tronWeb.setAddress(walletAddr)

            if (tokenAddress === TronConstant.token.wtrx) {
                await wrappedtrx(tronWeb, amount)
            }
        } else {
            cred =
                network === 'ARTHERA'
                    ? await unlockArthera(req, res)
                    : await unlockV2(req, res)
            if (!cred) return
        }
        var ret = await createBountiesCampaign(
            dataUrl,
            startDate,
            endDate,
            bounties,
            tokenAddress,
            amount,
            cred,
            tronWeb,
            res,
            limit,
            network
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        !!cred && lock(cred)
        if (ret?.hash) {
            if (currency.includes('SATT')) {
                amount = (amount * 95) / 100
            } else {
                amount = (amount * 85) / 100
            }
            var campaign = {
                hash: ret.hash,
                transactionHash: ret.transactionHash,
                startDate,
                endDate,
                limit,
                token: {
                    name: currency,
                    type: network,
                    addr: tokenAddress,
                },
                coverSrc: null,
                dataUrl,
                funds: [
                    (!!tronWeb && TronConstant.campaign.address) || contract,
                    amount,
                ],
                contract: (
                    (!!tronWeb && TronConstant.campaign.address) ||
                    contract
                ).toLowerCase(),
                walletId: (!!tronWeb && walletAddr) || cred.address,
                type: 'inProgress',
                cost: amount,
            }
            await Campaigns.updateOne(
                { _id },
                { $set: campaign },
                { $unset: { coverSrc: '', ratios: '' } }
            )
            let event = {
                id: ret.hash,
                type: 'modified',
                date: Math.floor(Date.now() / 1000),
                txhash: ret.transactionHash,
                contract: contract.toLowerCase(),
            }

            await Promise.allSettled([
                Event.create(event),
                notificationManager(id, 'create_campaign', {
                    cmp: campaign,
                }),
            ])
        }
    }
}

exports.uploadPictureToIPFS = async (req, res) => {
    // using IPFS
    try {
        if (req.file) {
            const { id } = req.params

            // SEARCH COMPAIGN ID
            const campaign = await Campaigns.findOne({
                _id: id,
                idNode: '0' + req.user._id,
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

exports.uploadExternalPictureToIPFS = async (req, res) => {
    // using IPFS
    try {
        if (req.file) {
            const { id } = req.params

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
exports.campaigns = async (req, res) => {
    try {
        let strangerDraft = []
        let idWallet =
            req.query.idWallet === 'null'
                ? JSON.parse(req.query.idWallet)
                : req.query.idWallet
        if (idWallet) {
            let userId = await getUserIdByWallet(
                req.query.idWallet.substring(2)
            )
            var idNode = '0' + userId
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

exports.campaignDetailsDraft = async (req, res) => {
    try {
        var _id = req.params.id
        var campaign = await Campaigns.findOne({ _id }).lean()
        return responseHandler.makeResponseData(res, 200, 'success', campaign)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.campaignDetails = async (req, res) => {
    try {
        var _id = req.params.id
        const projection =
            (req.query.projection === 'projection' && basicAtt) || null
        var campaign = await Campaigns.findOne({ _id }, projection).lean()

        if (campaign) {
            campaign.remaining = campaign.funds[1]
            return responseHandler.makeResponseData(
                res,
                200,
                'success',
                campaign
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

exports.campaignPromp = async (req, res) => {
    try {
        var { id: _id } = req.params

        const campaign = await fetchCampaign({ _id })
        var tronWeb

        const funds = campaign.funds ? campaign.funds[1] : campaign.cost
        const ratio = campaign.ratios
        const bounties = campaign.bounties
        let allLinks
        if (req.query.influencer) {
            let userWallet =
                (await Wallet.findOne(
                    {
                        'walletV2.keystore.address': req.query.influencer
                            .toLowerCase()
                            .substring(2),
                    },
                    { tronAddress: 1, _id: 0 }
                )) ||
                (await Wallet.findOne(
                    {
                        'keystore.address': req.query.influencer
                            .toLowerCase()
                            .substring(2),
                    },
                    { tronAddress: 1, _id: 0 }
                ))

            allLinks = await CampaignLink.find({
                $and: [
                    {
                        id_campaign: campaign.hash,
                        id_wallet:
                            (!!tronWeb && userWallet.tronAddress) ||
                            req.query.influencer,
                    },
                ],
            })
        }

        if (!req.query.influencer)
            allLinks = await CampaignLink.find({
                id_campaign: campaign.hash,
            })

        const allProms = await influencersLinks(allLinks, tronWeb)

        for (let i = 0; i < allProms.length; i++) {
            allProms[i].isAccepted = allProms[i].status
            allProms[i].influencer = allProms[i].id_wallet
            if (allProms[i].status == 'rejected') continue

            allProms[i].id = allProms[i].id_prom
            allProms[i].numberOfLikes = allProms[i].likes || '0'
            allProms[i].numberOfViews = allProms[i].views || '0'
            allProms[i].numberOfShares = !allProms[i].shares
                ? '0'
                : String(allProms[i].shares)
            allProms[i].payedAmount = allProms[i].payedAmount || '0'
            allProms[i].abosNumber = allProms[i].abosNumber || 0
            let result = allProms[i]

            let promDone = funds == '0' && result.fund == '0' ? true : false
            if (ratio.length && allProms[i].isAccepted && !promDone) {
                delete allProms[i].isPayed
                let reachLimit = getReachLimit(ratio, result.oracle)
                if (reachLimit)
                    result = limitStats(
                        '',
                        result,
                        '',
                        result._doc.abosNumber,
                        reachLimit
                    )
                ratio.forEach((num) => {
                    if (
                        num.oracle === result.oracle ||
                        num.typeSN === result._doc.typeSN
                    ) {
                        let view = result._doc.views
                            ? new Big(num['view']).times(result._doc.views)
                            : '0'
                        let like = result._doc.likes
                            ? new Big(num['like']).times(result._doc.likes)
                            : '0'
                        let share = result._doc.shares
                            ? new Big(num['share']).times(
                                  result._doc.shares.toString()
                              )
                            : '0'
                        let totalToEarn = new Big(view)
                            .plus(new Big(like))
                            .plus(new Big(share))
                            .toFixed()
                        allProms[i].totalToEarn = new Big(totalToEarn).gt(
                            new Big(result._doc.payedAmount)
                        )
                            ? totalToEarn
                            : result.payedAmount
                    }
                })
            }

            if (bounties.length && allProms[i].isAccepted && !promDone) {
                bounties.forEach((bounty) => {
                    if (
                        bounty.oracle === allProms[i].oracle ||
                        bounty.oracle == findBountyOracle(result.typeSN)
                    ) {
                        bounty = bounty.toObject()

                        bounty.categories.forEach((category) => {
                            if (
                                +category.minFollowers <= +result.abosNumber &&
                                +result.abosNumber <= +category.maxFollowers
                            ) {
                                let totalToEarn = category.reward
                                allProms[i].totalToEarn = new Big(
                                    totalToEarn
                                ).gt(new Big(result.payedAmount))
                                    ? totalToEarn
                                    : result.payedAmount
                            } else if (
                                +result.abosNumber > +category.maxFollowers
                            ) {
                                let totalToEarn = category.reward
                                allProms[i].totalToEarn = new Big(
                                    totalToEarn
                                ).gt(new Big(result.payedAmount))
                                    ? totalToEarn
                                    : result.payedAmount
                            }
                        })
                    }
                })
            }

            return responseHandler.makeResponseData(res, 200, 'success', {
                allProms,
            })
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

// Validate the idPost parameter
function isValidIdPost(idPost) {
    // Add your validation logic here
    // For example, check if it's a non-empty string, or if it matches a specific format
    return typeof idPost === 'string' && idPost.trim().length > 0
}
const getThreadsUserName = async (idPost) => {
    const res = await axios.get(`https://www.threads.net/t/${idPost}`)

    if (!isValidIdPost(idPost)) {
        throw new Error('Invalid idPost')
    }

    let text = res.data
    text = text.replace(/\s/g, '')
    text = text.replace(/\n/g, '')

    const postID = text.match(/{"post_id":"(.*?)"}/)?.[1]
    const lsdToken = text.match(/"LSD",\[\],{"token":"(\w+)"},\d+\]/)?.[1]

    const headers = {
        Authority: 'www.threads.net',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://www.threads.net',
        Pragma: 'no-cache',
        'Sec-Fetch-Site': 'same-origin',
        'X-ASBD-ID': '129477',
        'X-FB-LSD': lsdToken,
        'X-IG-App-ID': '238260118697367',
    }

    const response = await axios.post(
        'https://www.threads.net/api/graphql',
        {
            lsd: lsdToken,
            variables: JSON.stringify({
                postID,
            }),
            doc_id: '5587632691339264',
        },
        {
            headers,
            transformRequest: [
                (data) => {
                    return Object.entries(data)
                        .map(
                            ([key, value]) =>
                                `${encodeURIComponent(
                                    key
                                )}=${encodeURIComponent(value)}`
                        )
                        .join('&')
                },
            ],
        }
    )
    return response?.data?.data?.containing_thread?.thread_items[0]?.post?.user
        .username
}

exports.apply = async (req, res) => {
    var id = req.user._id
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
    } = req.body
    let [prom, date, hash] = [{}, Math.floor(Date.now() / 1000), req.body.hash]
    var campaignDetails = await Campaigns.findOne({ hash }).lean()
    let limit = campaignDetails.limit
    let userWallet = await Wallet.findOne({ UserId: req.user._id })
    let numberParticipation = await CampaignLink.find({
        id_campaign: hash,
        id_wallet: '0x' + userWallet.walletV2.keystore.address,
    }).count()
    if (limit > 0 && limit === numberParticipation) {
        return responseHandler.makeResponseError(
            res,
            401,
            'Limit participation reached'
        )
    }

    try {
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
        var cred
        var tronWeb
        req.body.network = campaignDetails.token.type
        if (campaignDetails.token.type === 'TRON') {
            let privateKey = (
                await getWalletTron(id, pass, req.body.Walletversion)
            ).priv

            //signature tron
            tronWeb = await webTronInstance()

            let hexStrWithout0x = tronWeb
                .toHex(req.body.idPost)
                .replace(/^0x/, '')
            // conert hex string to byte array
            let byteArray = tronWeb.utils.code.hexStr2byteArray(hexStrWithout0x)
            // keccak256 computing, then remove "0x"
            let strHash = tronWeb.sha3(byteArray).replace(/^0x/, '')

            signature = await tronWeb.trx.sign(strHash, privateKey)

            tronWeb.setPrivateKey(privateKey)
            var walletAddr = tronWeb.address.fromPrivateKey(privateKey)
            tronWeb.setAddress(walletAddr)
        } else {
            if (!req.user.hasWalletV2)
                return responseHandler.makeResponseError(
                    res,
                    401,
                    'Wallet v2 not found'
                )
            cred =
                req.body.network === 'ARTHERA'
                    ? await unlockArthera(req, res)
                    : await unlockV2(req, res)
            let decryptAccount =
                req.body.network === 'ARTHERA'
                    ? await cred.Web3ARTHERA.eth.accounts.wallet.decrypt(
                          [userWallet.walletV2.keystore],
                          req.body.pass
                      )
                    : await cred.Web3BEP20.eth.accounts.wallet.decrypt(
                          [userWallet.walletV2.keystore],
                          req.body.pass
                      )

            signature =
                req.body.network === 'ARTHERA'
                    ? await cred.Web3ARTHERA.eth.accounts.sign(
                          req.body.idPost + hash,
                          decryptAccount[0].privateKey
                      )
                    : await cred.Web3BEP20.eth.accounts.sign(
                          req.body.idPost + hash,
                          decryptAccount[0].privateKey
                      )
            if (!cred) return
        }

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

        prom.applyerSignature = signature
        prom.typeSN = typeSN.toString()
        prom.idUser = idUser
        if (media_url) prom.media_url = media_url
        if (prom.typeSN == 5) {
            prom.typeURL = linkedinInfo.idPost.split(':')[2]
            prom.linkedinId = linkedinId
        }
        prom.id_wallet = (!!tronWeb && walletAddr) || cred.address.toLowerCase()
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

        return responseHandler.makeResponseData(res, 200, 'success', insert)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        cred && lock(cred)
    }
}

exports.linkNotifications = async (req, res) => {
    // Sanitize and destructure the request body
    const { idCampaign: campaignId, link, idProm } = sanitize(req.body)
    // Set the language for translation
    const lang = req.query.lang || 'en'
    configureTranslation(lang)

    try {
        // Fetch the campaign
        const element = await fetchCampaign({ _id: campaignId })
        let owner = Number(element.idNode.substring(1))

        // Notify the campaign owner
        await notificationManager(owner, 'cmp_candidate_insert_link', {
            cmp_name: element.title,
            cmp_hash: campaignId,
            linkHash: idProm,
        })

        let user = await User.findOne({ _id: owner }, { email: 1 }).lean()

        readHTMLFileCampaign(
            __dirname +
                '/../public/emailtemplate/Email_Template_link_added.html',
            'linkNotifications',
            element.title,
            user.email,
            null,
            link
        )
        // Respond with succes
        return responseHandler.makeResponseData(
            res,
            200,
            'Email was sent to ' + user.email
        )
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.validateCampaignExt = async (req, res) => {
    try {
        let link = await CampaignLink.findOne({ _id: req.body.prom.id }).lean()

        const campaignId = req.body.prom.campaign._id

        const campaign = await Campaigns.findOne({ _id: campaignId }).lean()

        let linkedinProfile =
            link.oracle == 'linkedin' &&
            (await LinkedinProfile.findOne({ userId: req.body.userId }))
        let tiktokProfile =
            link.oracle == 'tiktok' &&
            (await TikTokProfile.findOne({ userId: req.body.userId }))
        let userId = link.oracle === 'instagram' ? req.body.userId : null
        let socialOracle = await getPromApplyStats(
            link.oracle,
            link,
            userId,
            linkedinProfile,
            tiktokProfile
        )
        delete socialOracle.id_prom

        socialOracle.status = true
        link.status = true
        if (socialOracle.views === 'old') socialOracle.views = link.views || '0'
        link.likes = socialOracle.likes ?? '0'
        link.views = socialOracle?.views ?? '0'
        link.shares = socialOracle.shares ?? '0'
        link.campaign = campaign
        link.totalToEarn = campaign.ratios.length
            ? getTotalToEarn(link, campaign.ratios)
            : getReward(link, campaign.bounties)
        socialOracle.totalToEarn = link.totalToEarn
        socialOracle.type = getButtonStatus(link)
        socialOracle.acceptedDate = Math.floor(Date.now() / 1000)
        socialOracle.id_prom = req.body.ret.toString()
        await CampaignLink.updateOne(
            { _id: req.body.prom.id },
            {
                $set: {
                    ...socialOracle,
                    id_prom: req.body.ret.toString(),
                },
            }
        )

        return responseHandler.makeResponseData(res, 200, 'success')
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.validateCampaign = async (req, res) => {
    /*const _id = req.body.idCampaign
    const linkProm = req.body.link
    const idLink = req.body.idLink
    const idApply = req.body.signature*/
    const idUser = `0${req.user._id}`
    //const pass = req.body.pass
    const {
        idCampaign: _id,
        idLink,
        signature: idApply,
        link: linkProm,
        pass,
    } = req.body
    let signature
    let ownerLink
    if (!mongoose.Types.ObjectId.isValid(_id)) {
        return responseHandler.makeResponseError(
            res,
            400,
            'Please enter a valid id!'
        )
    }
    const campaign = await fetchCampaign({ _id })

    try {
        if (idUser === campaign?.idNode) {
            const lang = 'en'
            configureTranslation(lang)
            var tronWeb
            var cred

            let campaignLink = await CampaignLink.findOne({
                _id: idLink,
            }).lean()

            signature = campaignLink.applyerSignature

            ownerLink = campaignLink.id_wallet

            if (campaign.token.type === 'TRON') {
                let privateKey = await getWalletTron(
                    req.user._id,
                    pass,
                    req.body.Walletversion
                ).priv

                tronWeb = await webTronInstance()

                let hexStrWithout0x = await tronWeb
                    .toHex(campaignLink.idPost)
                    .replace(/^0x/, '')
                var byteArray = await tronWeb.utils.code.hexStr2byteArray(
                    hexStrWithout0x
                )

                var strHash = await tronWeb.sha3(byteArray).replace(/^0x/, '')

                var verifyLInk = await tronWeb.trx.verifyMessage(
                    strHash,
                    campaignLink.applyCampaign,
                    campaignLink.id_wallet
                )

                tronWeb.setPrivateKey(privateKey)
                let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
                tronWeb.setAddress(walletAddr)
            } else {
                req.body.network = campaign.token.type
                cred =
                    req.body.network === 'ARTHERA'
                        ? await unlockArthera(req, res)
                        : await unlockV2(req, res)
                if (
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                ) {
                    const recoveredSigner = verifySignature(
                        campaignLink.applyerSignature.messageHash,
                        campaignLink.applyerSignature.signature,
                        campaignLink.id_wallet
                    )
                    if (!recoveredSigner) {
                        return responseHandler.makeResponseError(
                            res,
                            401,
                            'the signature is not matched  to the link or signature'
                        )
                    }
                } else {
                    const recoveredSigner =
                        req.body.network === 'ARTHERA'
                            ? await cred.Web3ARTHERA.eth.accounts.recover(
                                  campaignLink.applyerSignature
                              )
                            : await cred.WEB3.eth.accounts.recover(
                                  campaignLink.applyerSignature
                              )
                    if (
                        recoveredSigner.toLowerCase() !== campaignLink.id_wallet
                    ) {
                        return responseHandler.makeResponseError(
                            res,
                            401,
                            'the signature is not matched  to the link or signature'
                        )
                    }
                }
                let messageHashSignature
                if (
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                )
                    messageHashSignature = utils.hashMessage(
                        signature.messageHash
                    )
                var ret = await validateProm(
                    campaignLink.id_campaign,
                    campaignLink.typeSN,
                    campaignLink.idPost,
                    campaignLink.idUser,
                    !isNaN(campaignLink.abosNumber)
                        ? campaignLink.abosNumber
                        : 0,
                    ownerLink,
                    typeof campaignLink.userExternal !== 'undefined' &&
                        campaignLink.userExternal === true
                        ? messageHashSignature
                        : signature.messageHash,
                    signature.v,
                    signature.r,
                    signature.s,
                    cred,
                    tronWeb,
                    req.body.network
                )
            }

            if (cred) {
                lock(cred)
            }
            if (ret && ret.transactionHash) {
                let link = await CampaignLink.findOne({ _id: idLink }).lean()
                let userWallet
                if (
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                ) {
                    userWallet = await UserExternalWallet.findOne({
                        walletId: link.id_wallet,
                    })
                } else {
                    userWallet =
                        (!!tronWeb &&
                            (await Wallet.findOne(
                                {
                                    $or: [
                                        { tronAddress: link.id_wallet },
                                        {
                                            'walletV2.tronAddress':
                                                link.id_wallet,
                                        },
                                    ],
                                },
                                { UserId: 1, _id: 0 }
                            ))) ||
                        (await Wallet.findOne(
                            {
                                $or: [
                                    {
                                        'walletV2.keystore.address':
                                            link.id_wallet
                                                .toLowerCase()
                                                .substring(2),
                                    },
                                    {
                                        'keystore.address': link.id_wallet
                                            .toLowerCase()
                                            .substring(2),
                                    },
                                ],
                            },
                            { UserId: 1, _id: 0 }
                        ))
                }

                let user =
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                        ? userWallet
                        : await User.findOne({ _id: userWallet.UserId }).lean()
                const id =
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                        ? user.UserId
                        : user._id
                const email =
                    typeof campaignLink.userExternal !== 'undefined' &&
                    campaignLink.userExternal === true
                        ? ''
                        : user.email
                let linkedinProfile =
                    link.oracle == 'linkedin' &&
                    (await LinkedinProfile.findOne({ userId: id }))
                let tiktokProfile =
                    link.oracle == 'tiktok' &&
                    (await TikTokProfile.findOne({ userId: id }))
                let userId = link.oracle === 'instagram' ? id : null
                let socialOracle = await getPromApplyStats(
                    link.oracle,
                    link,
                    userId,
                    linkedinProfile,
                    tiktokProfile
                )
                socialOracle.status = true
                link.status = true
                if (socialOracle.views === 'old')
                    socialOracle.views = link.views || '0'
                link.likes = socialOracle.likes ?? '0'
                link.views = socialOracle?.views ?? '0'
                link.shares = socialOracle.shares ?? '0'
                link.campaign = campaign
                link.totalToEarn = campaign.ratios.length
                    ? getTotalToEarn(link, campaign.ratios)
                    : getReward(link, campaign.bounties)
                socialOracle.totalToEarn = link.totalToEarn
                socialOracle.type = getButtonStatus(link)
                socialOracle.acceptedDate = Math.floor(Date.now() / 1000)
                socialOracle.id_prom = ret.prom
                await CampaignLink.updateOne(
                    { _id: idLink },
                    { $set: socialOracle }
                )
                if (
                    !(
                        typeof campaignLink.userExternal !== 'undefined' &&
                        campaignLink.userExternal === true
                    )
                ) {
                    await notificationManager(id, 'cmp_candidate_accept_link', {
                        cmp_name: campaign.title,
                        action: 'link_accepted',
                        cmp_link: linkProm,
                        cmp_hash: _id,
                        hash: ret.transactionHash,
                        promHash: idLink,
                    })
                    readHTMLFileCampaign(
                        __dirname +
                            '/../public/emailtemplate/email_validated_link.html',
                        'campaignValidation',
                        campaign.title,
                        email,
                        _id
                    )
                }
            }

            return responseHandler.makeResponseData(res, 200, 'success', ret)
        } else {
            return responseHandler.makeResponseError(res, 401, 'unothorized')
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.gains = async (req, res) => {
    req.body = sanitize(req.body)
    var idProm = req.body.idProm
    var hash = req.body.hash
    var stats
    var requests = false
    var campaignData
    try {
        var link = await CampaignLink.findOne({ id_prom: idProm }).lean()
        //86400 one day
        var date = Math.floor(Date.now() / 1000)
        if (link.acceptedDate && date - link.acceptedDate <= 86400) {
            return responseHandler.makeResponseError(
                res,
                403,
                "You didn't exceed the limits timing to harvest again"
            )
        } else {
            var tronWeb
            var credentials
            var ctr
            var gasPrice
            var wrappedTrx = false
            campaignData = await Campaigns.findOne({ hash: hash }).lean()
            req.body.network = campaignData.token.type
            credentials =
                req.body.network === 'ARTHERA'
                    ? await unlockArthera(req, res)
                    : await unlockV2(req, res)
            if (campaignData.token.type === 'TRON') {
                let privateKey = (
                    await getWalletTron(req.user._id, req.body.pass)
                ).priv
                tronWeb = await webTronInstance()
                tronWeb.setPrivateKey(privateKey)
                var walletAddr = tronWeb.address.fromPrivateKey(privateKey)
                tronWeb.setAddress(walletAddr)
                ctr = await tronWeb.contract(
                    TronConstant.campaign.abi,
                    TronConstant.campaign.address
                )
                wrappedTrx = campaignData.token.addr === TronConstant.token.wtrx
                tronWeb.wrappedTrx = wrappedTrx
            } else {
                if (req.body.network === 'ARTHERA') {
                    ctr = new credentials.Web3ARTHERA.eth.Contract(
                        CampaignConstants[ArtheraNetworkConstant].abi,
                        CampaignConstants[ArtheraNetworkConstant].address
                    )
                    gasPrice = await credentials.Web3ARTHERA.eth.getGasPrice()
                } else {
                    ctr = await getPromContract(idProm, credentials)
                    gasPrice = await ctr.getGasPrice()
                }
            }

            let prom =
                (!!tronWeb && (await ctr.proms(idProm).call())) ||
                (await ctr.methods.proms(idProm).call())

            if (prom.lastHarvest && date - prom.lastHarvest <= 86400) {
                return responseHandler.makeResponseError(
                    res,
                    403,
                    "You didn't exceed the limits timing to harvest between 24H"
                )
            }
            var linkedinData =
                prom.typeSN == '5' &&
                (await LinkedinProfile.findOne(
                    {
                        userId: req.user._id,
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
                        campaignData.token.addr,
                        req.body.network
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
                    bountie.categories[bountie.categories.length - 1]
                        .maxFollowers
                var evts = await updateBounty(
                    idProm,
                    credentials,
                    tronWeb,
                    req.body.network
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
                            idUser: prom.idUser,
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
                    var ret = await getGains(
                        idProm,
                        credentials,
                        tronWeb,
                        campaignData.token.addr,
                        req.body.network
                    )

                    if (ret) {
                        await User.updateOne(
                            { _id: req.user._id },
                            {
                                $set: {
                                    lastHarvestDate: Date.now(),
                                },
                            }
                        )
                    }

                    return responseHandler.makeResponseData(
                        res,
                        200,
                        'success',
                        ret
                    )
                }
            }

            var prevstat = await Request.find({
                new: false,
                typeSN: prom.typeSN,
                idPost: prom.idPost,
                idUser: prom.idUser,
                idCampaign: prom.idCampaign,
            }).sort({ date: -1 })

            if (prom.typeSN == '6') {
                var tiktokProfile = await TikTokProfile.findOne({
                    userId: req.user._id,
                })
            }
            const external = false
            stats = await answerOne(
                prom.typeSN + '',
                prom.idPost + '',
                prom.idUser + '',
                link.typeURL,
                linkedinData,
                tiktokProfile,
                prom.instagramUserName,
                external
            )
            var copyStats = { ...stats }
            var ratios =
                (!!tronWeb && (await ctr.getRatios(prom.idCampaign).call())) ||
                (await ctr.methods.getRatios(prom.idCampaign).call())

            var abos = link.abosNumber
            if (stats) stats = limitStats(prom.typeSN, stats, ratios, abos, '')
            stats.views = stats?.views || 0
            if (stats.views === 'old') stats.views = link?.views
            stats.shares = stats?.shares || 0
            stats.likes = stats?.likes || 0
            requests = await Request.find({
                new: true,
                isBounty: false,
                typeSN: prom.typeSN,
                idPost: prom.idPost,
                idUser: prom.idUser,
            })
            if (!requests.length) {
                if (
                    !prevstat.length ||
                    stats?.likes != prevstat[0]?.likes ||
                    stats?.shares != prevstat[0]?.shares ||
                    stats?.views != prevstat[0]?.views
                ) {
                    var evts = await updatePromStats(
                        idProm,
                        credentials,
                        tronWeb,
                        res,
                        req.body.network
                    )
                    if (evts?.error)
                        return responseHandler.makeResponseError(
                            res,
                            500,
                            evts.error.message
                                ? evts.error.message
                                : evts.error.error
                        )
                    var evt = evts.events[0]
                    var idRequest =
                        (!!tronWeb && evt.result.idRequest) || evt.raw.topics[1]
                    requests = [{ id: idRequest }]
                }
            }

            if (requests && requests.length) {
                await Request.updateOne(
                    { id: requests[0].id },
                    {
                        $set: {
                            id: requests[0].id,
                            likes: stats.likes,
                            shares: stats.shares,
                            views: stats?.views,
                            new: false,
                            date: Date.now(),
                            typeSN: prom.typeSN,
                            idPost: prom.idPost,
                            idUser: prom.idUser,
                        },
                    },
                    { upsert: true }
                )
                let campaignContractOwnerAddr = await getCampaignOwnerAddr(
                    idProm
                )
                await answerCall({
                    credentials,
                    tronWeb,
                    gasPrice: gasPrice,
                    from: campaignContractOwnerAddr,
                    campaignContract:
                        (!!tronWeb && TronConstant.campaign.address) ||
                        ctr.options.address,
                    idRequest: requests[0].id,
                    likes: stats.likes,
                    shares: stats?.shares,
                    views: stats?.views,
                })
            }

            var ret = await getGains(
                idProm,
                credentials,
                tronWeb,
                campaignData.token.addr,
                req.body.network
            )
            if (ret) {
                await CampaignLink.updateOne(
                    { id_prom: idProm },
                    {
                        $set: {
                            lastHarvestDate: Math.floor(
                                new Date().getTime() / 1000
                            ),
                        },
                    }
                )

                await User.updateOne(
                    { _id: req.user._id },
                    {
                        $set: {
                            lastHarvestDate: Date.now(),
                        },
                    }
                )
            }
            return responseHandler.makeResponseData(res, 200, 'success', ret)
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        credentials && lock(credentials)
        if (ret?.transactionHash) {
            let campaignType = {}

            let network =
                !!credentials &&
                (campaignData.token.type === 'ARTHERA'
                    ? credentials.Web3ARTHERA
                    : credentials.WEB3)
            let amount = await getTransactionAmount(
                credentials,
                campaignData.token.type,
                ret.transactionHash,
                network
            )
            let updatedFUnds = { ...copyStats }

            let cmpLink = await CampaignLink.findOne({ id_prom: idProm }).lean()
            req.body.bounty && (updatedFUnds.isPayed = true)
            updatedFUnds.payedAmount = !cmpLink.payedAmount
                ? amount
                : new Big(cmpLink.payedAmount).plus(new Big(amount)).toFixed()
            updatedFUnds.type = 'already_recovered'
            await CampaignLink.updateOne(
                { id_prom: idProm },
                { $set: updatedFUnds }
            )

            let contract = await getCampaignContractByHashCampaign(
                hash,
                credentials,
                tronWeb
            )
            var result =
                (!!tronWeb && (await contract.campaigns('0x' + hash).call())) ||
                (await contract.methods.campaigns(hash).call())
            if (!!tronWeb) {
                campaignType.funds = [
                    result.token,
                    tronWeb.toDecimal(result.amount._hex),
                ]
                if (tronWeb.toDecimal(result.amount._hex) === 0)
                    campaignType.type = 'finished'
            } else {
                campaignType.funds = result.funds
                if (result.funds[1] === '0') campaignType.type = 'finished'
            }
            await Campaigns.updateOne({ hash: hash }, { $set: campaignType })
        }
    }
}

exports.saveCampaign = async (req, res) => {
    try {
        let campaign = req.body
        campaign.idNode = '0' + req.user._id
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

exports.kits = async (req, res) => {
    try {
        const idCampaign = req.params.id
        gfsKit.files
            .find({ 'campaign.$id': ObjectId(idCampaign) })
            .toArray((err, files) => {
                return responseHandler.makeResponseData(
                    res,
                    200,
                    'success',
                    files
                )
            })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.addKits = async (req, res) => {
    try {
        let files = req.files
        let links =
            typeof req.body.link === 'string'
                ? Array(req.body.link)
                : req.body.link
        let idCampaign = ObjectId(req.body.campaign)

        if (files) {
            await Promise.all(
                files.map((file) => {
                    return gfsKit.files.updateOne(
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
                })
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

exports.externalAddKits = async (req, res) => {
    try {
        let files = req.files
        let links =
            typeof req.body.link === 'string'
                ? Array(req.body.link)
                : req.body.link
        let idCampaign = ObjectId(req.body.campaign)

        if (files) {
            await Promise.all(
                files.map((file) => {
                    return gfsKit.files.updateOne(
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
                })
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

exports.findKit = async (req, res) => {
    try {
        const _id = req.params.id
        let file = await gfsKit.files.findOne({ _id: ObjectId(_id) })
        if (!file.filename || file.length === 0) {
            return responseHandler.makeResponseError(res, 204, 'no files exist')
        } else {
            if (file.contentType) {
                contentType = file.contentType
            } else {
                contentType = file.mimeType
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename=${file.filename}`,
            })
            const readstream = gfsKit.createReadStream(file.filename)
            readstream.pipe(res)
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.deleteKit = async (req, res) => {
    try {
        const _id = req.params.id

        gfsKit.files.deleteOne({ _id: ObjectId(_id) }, (err, data) => {
            return responseHandler.makeResponseData(
                res,
                200,
                'kit deleted',
                true
            )
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.update = async (req, res) => {
    try {
        let campaign = req.body
        campaign.updatedAt = Date.now()
        let updatedCampaign = await Campaigns.findOneAndUpdate(
            { _id: req.params.id, idNode: '0' + req.user._id },
            { $set: campaign },
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

exports.extUpdate = async (req, res) => {
    try {
        let campaign = req.body
        campaign.updatedAt = Date.now()
        let updatedCampaign = await Campaigns.updateOne(
            { _id: req.params.id, idNode: req.body.userId },
            { $set: campaign.values },
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

module.exports.linkStats = async (req, res) => {
    try {
        let totalToEarn
        const idProm = req.params.id

        const info = await CampaignLink.findOne({ id_prom: idProm }).lean()

        if (info) {
            const payedAmount = info.payedAmount || '0'
            const campaign = (
                await Campaigns.findOne(
                    { hash: info.id_campaign },
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
            )?.toObject()
            const ratio = campaign.ratios
            const bounties = campaign.bounties
            let abosNumber = info.abosNumber || 0
            info.currency = campaign.token.name
            if (ratio.length) {
                let socialStats = {
                    likes: info.likes,
                    shares: info.shares,
                    views: info.views,
                }
                let reachLimit = getReachLimit(ratio, info.oracle)
                if (reachLimit)
                    socialStats = limitStats(
                        '',
                        socialStats,
                        '',
                        abosNumber,
                        reachLimit
                    )
                ratio.forEach((elem) => {
                    if (elem.oracle === info.oracle) {
                        if (elem.oracle === 'threads') {
                            let like = new Big(elem['like']).times(
                                socialStats.likes || '0'
                            )
                            totalToEarn = like.toFixed()
                        } else {
                            let view = new Big(elem['view']).times(
                                socialStats.views || '0'
                            )
                            let like = new Big(elem['like']).times(
                                socialStats.likes || '0'
                            )
                            let share = new Big(elem['share']).times(
                                socialStats.shares || '0'
                            )
                            totalToEarn = view.plus(like).plus(share).toFixed()
                        }
                    }
                })
                info.totalToEarn = new Big(totalToEarn).gte(
                    new Big(payedAmount)
                )
                    ? new Big(totalToEarn).minus(new Big(payedAmount))
                    : totalToEarn
            }

            if (bounties.length) {
                bounties.forEach((bounty) => {
                    if (bounty.oracle === info.oracle) {
                        bounty.categories.forEach((category) => {
                            if (
                                +category.minFollowers <= +abosNumber &&
                                +abosNumber <= +category.maxFollowers
                            ) {
                                info.totalToEarn = category.reward
                            } else if (+abosNumber > +category.maxFollowers) {
                                info.totalToEarn = category.reward
                            }
                        })
                    }
                })
            }
            if (new Big(info.totalToEarn).gt(new Big(campaign.funds[1])))
                info.totalToEarn = campaign.funds[1]
            return responseHandler.makeResponseData(res, 200, 'success', info)
        } else {
            return responseHandler.makeResponseError(res, 204, 'link not found')
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.increaseBudget = async (req, res) => {
    var pass = req.body.pass
    var hash = req.body.hash
    var token = req.body.tokenAddress
    var amount = req.body.amount
    try {
        var cred = await unlock(req, res)

        var ret = await fundCampaign(hash, token, amount, cred)

        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        cred && lock(cred)
        if (ret?.transactionHash) {
            const ctr = await getCampaignContractByHashCampaign(hash, cred)
            let fundsInfo = await ctr.methods.campaigns(hash).call()

            let campaign = await Campaigns.findOne({ hash }, { cost: 1 }).lean()
            let budget = new Big(campaign.cost).plus(new Big(amount)).toFixed()
            await Campaigns.updateOne(
                { hash: hash },
                { $set: { cost: budget, funds: fundsInfo.funds } }
            )
        }
    }
}

exports.getFunds = async (req, res) => {
    req.body = sanitize(req.body)
    var { hash } = req.body
    try {
        let { _id } = req.user
        var campaignDetails = await Campaigns.findOne(
            { hash },
            { idNode: 1 }
        ).lean()

        if (campaignDetails?.idNode !== `0${_id}`) {
            return responseHandler.makeResponseError(res, 204, 'unauthorized')
        } else {
            var cred = await unlockV2(req, res)
            var ret = await getRemainingFunds(hash, cred)

            return responseHandler.makeResponseData(
                res,
                200,
                'budget retrieved',
                ret
            )
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    } finally {
        cred && lock(cred)
        if (ret?.transactionHash) {
            await Campaigns.updateOne(
                { _id: campaignDetails._id },
                {
                    $set: {
                        funds: ['', '0'],
                    },
                }
            )
        }
    }
}

exports.approveCampaign = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let token = req.body.tokenAddress

        var cred = await unlockNetwork(req, res)
        if (!cred) return

        let ret = await approve(
            token ? token : wrapConstants[cred.network].address,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        !!cred.web3 && lockNetwork(cred)
    }
}
exports.campaignAllowance = async (req, res) => {
    try {
        let tokenAddress = req.body.tokenAddress
        let campaignAddress = req.body.campaignAddress
        let account = await getAccount(req, res)
        let allowance = await allow(
            tokenAddress,
            account.address,
            campaignAddress,
            req
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.artheraApproval = async (req, res) => {
    try {
        let tokenAddress = process.env.ARTHERA_MOCK_TOKEN
        let campaignAddress = req.body.campaignAddress
        let account = await getAccount(req, res) // FIXED
        let allowance = await artheraApprove(
            tokenAddress,
            account.address,
            campaignAddress
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.artheraAllow = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let polygonToken = process.env.ARTHERA_MOCK_TOKEN
        var cred = await unlockArthera(req, res)
        if (!cred) return

        let ret = await artheraAllow(
            polygonToken,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        if (cred) lock(cred)
    }
}

exports.bttApproval = async (req, res) => {
    try {
        let tokenAddress = req.body.tokenAddress
        let campaignAddress = req.body.campaignAddress
        let account = await getAccount(req, res)
        let allowance = await bttApprove(
            tokenAddress,
            account.address,
            campaignAddress
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.bttAllow = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let polygonToken = req.body.tokenAddress
        var cred = await unlock(req, res)
        if (!cred) return

        let ret = await bttAllow(
            polygonToken,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        if (cred) lock(cred)
    }
}

exports.tronApproval = async (req, res) => {
    try {
        let tokenAddress = req.body.tokenAddress
        let privateKey = (
            await getWalletTron(req.user._id, req.body.pass, req.body.version)
        ).priv
        let tronWeb = await webTronInstance(privateKey)
        tronWeb.setPrivateKey(privateKey)
        let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
        tronWeb.setAddress(walletAddr)
        let allowance = await tronApprove(
            walletAddr,
            tronWeb,
            tokenAddress,
            res
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            allowance: allowance,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.tronAllow = async (req, res) => {
    try {
        let amount = '100000000000000000000000000000000'
        let privateKey = (await getWalletTron(req.user._id, req.body.pass)).priv
        let tronWeb = await webTronInstance(privateKey)
        tronWeb.setPrivateKey(privateKey)
        let tokenAddress = req.body.tokenAddress
        let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
        tronWeb.setAddress(walletAddr)
        let ret = await tronAllowance(tronWeb, tokenAddress, amount, res)
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.bep20Approval = async (req, res) => {
    try {
        let tokenAddress = req.body.tokenAddress
        let campaignAddress = req.body.campaignAddress
        let account = await getAccountV2(req, res)
        let allowance = await bep20Approve(
            tokenAddress,
            account.address,
            campaignAddress
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.polygonApproval = async (req, res) => {
    try {
        let { tokenAddress, campaignAddress } = req.body
        let account = await getAccount(req, res)
        let allowance = await polygonApprove(
            tokenAddress,
            account.address,
            campaignAddress
        )
        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.polygonAllow = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let polygonToken = req.body.tokenAddress
        var cred = await unlockPolygon(req, res)
        if (!cred) return
        let ret = await polygonAllow(
            polygonToken,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        if (cred) lockPolygon(cred)
    }
}

exports.erc20Approval = async (req, res) => {
    try {
        let tokenAddress = req.body.tokenAddress
        let campaignAddress = req.body.campaignAddress
        let account = await getAccountV2(req, res)
        let allowance = await erc20Approve(
            tokenAddress,
            account.address,
            campaignAddress
        )

        return responseHandler.makeResponseData(res, 200, 'success', {
            token: tokenAddress,
            allowance: allowance,
            spender: campaignAddress,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    }
}

exports.bep20Allow = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let bep20TOken =
            req.body.tokenAddress === null
                ? process.env.CONST_WBNB
                : req.body.tokenAddress
        var cred = await unlockBsc(req, res)
        if (!cred) return
        let ret = await bep20Allow(
            bep20TOken,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        if (cred) lockBSC(cred)
    }
}

exports.erc20Allow = async (req, res) => {
    try {
        let campaignAddress = req.body.campaignAddress
        let amount = req.body.amount
        let tokenAddress = req.body.tokenAddress
        var cred = await unlock(req, res)
        if (!cred) return

        let ret = await erc20Allow(
            tokenAddress,
            cred,
            campaignAddress,
            amount,
            res
        )
        if (!ret) return
        return responseHandler.makeResponseData(res, 200, 'success', ret)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error,
            false
        )
    } finally {
        if (cred) lockERC20(cred)
    }
}

exports.getLinks = async (req, res) => {
    try {
        const userId = req.params.idUser
        const accountData = await Wallet.findOne({ UserId: userId }).lean()
        const { version } = req.query
        const limit = +req.query.limit || 50
        const page = +req.query.page || 1
        const skip = limit * (page - 1)
        let arrayOfLinks = []
        let arrayOfTronLinks = []

        let allProms = []
        let allTronProms = []
        let query1 = {}
        version === 'v1' &&
            (query1 = filterLinks(req, '0x' + accountData?.keystore?.address))
        let query3 = filterLinks(
            req,
            '0x' + accountData.walletV2?.keystore?.address
        )
        let query2 = filterLinks(req, accountData?.tronAddress)
        let query4 = filterLinks(req, accountData.walletV2?.tronAddress)

        var count =
            (await CampaignLink.find(
                { id_wallet: { $in: [query1.id_wallet, query3.id_wallet] } },
                { type: { $exists: 0 } }
            ).countDocuments()) +
            ((!!accountData.tronAddress &&
                !!accountData.walletV2?.tronAddress &&
                req.query.state === 'part' &&
                (await CampaignLink.find(
                    {
                        tronAddress: {
                            $in: [
                                accountData.tronAddress,
                                accountData.walletV2?.tronAddress,
                            ],
                        },
                    },
                    { type: { $exists: 0 } }
                ).countDocuments())) ||
                0)

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
                $match: (version === 'v1' && query1) || query3,
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

        let tronUserLinks =
            (!!accountData.tronAddress &&
                !!accountData.walletV2?.tronAddress &&
                (await CampaignLink.aggregate([
                    {
                        $match: (version === 'v1' && query2) || query4,
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
                    .limit(limit))) ||
            []

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

        for (let i = 0; i < tronUserLinks.length; i++) {
            let result = tronUserLinks[i]
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
                arrayOfTronLinks.push(result)
            }
        }
        allTronProms =
            req.query.campaign && req.query.state
                ? await influencersLinks(arrayOfTronLinks, true)
                : arrayOfTronLinks

        var Links = {
            Links: [
                ...allProms,
                ...((req.query.state === 'owner' && []) || allTronProms),
            ],
            count,
        }
        return responseHandler.makeResponseData(res, 200, 'success', Links)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.campaignStatistics = async (req, res) => {
    try {
        var hash = req.params.hash
        var arrayOfUser = []
        var arrayOfnbAbos = []
        var nbTotalUser = 0
        var totalAbos = 0
        let result = {
            facebook: initStat(),
            twitter: initStat(),
            instagram: initStat(),
            youtube: initStat(),
            linkedin: initStat(),
            tiktok: initStat(),
        }
        var links = await CampaignLink.find({ id_campaign: hash })

        for (i = 0; i < links.length; i++) {
            let link = links[i]
            let oracle = link.oracle
            result[oracle] = calcSNStat(result[oracle], link)
            if (arrayOfUser.indexOf(link.id_wallet) === -1) {
                nbTotalUser++
                arrayOfUser.push(link.id_wallet)
            }
            if (
                arrayOfnbAbos.indexOf(link.id_wallet + '|' + link.typeSN) === -1
            ) {
                if (link.abosNumber) totalAbos += +link.abosNumber
                arrayOfUser.push(link.id_wallet + '|' + link.typeSN)
            }
        }
        res.json({
            stat: result,
            creatorParticipate: nbTotalUser,
            reachTotal: totalAbos,
        })
    } catch (err) {
        res.end(
            JSON.stringify({ error: err.message ? err.message : err.error })
        )
    }
}

module.exports.campaignInvested = async (req, res) => {
    try {
        let prices = getPrices()
        let sattPrice$ = prices.SATT.price
        let totalInvested = '0'
        let userCampaigns = await Campaigns.find({
            idNode: '0' + req.user._id,
            hash: { $exists: true },
        })

        userCampaigns.forEach((elem) => {
            totalInvested = new Big(totalInvested).plus(new Big(elem.cost))
        })
        let totalInvestedUSD =
            sattPrice$ *
            parseFloat(new Big(totalInvested).div(etherInWei).toFixed(0))
        totalInvested = new Big(totalInvested).toFixed()

        res.json({ totalInvested, totalInvestedUSD })
    } catch (e) {}
}

//REJECT influencer link controller by advertiser
exports.rejectLink = async (req, res) => {
    const {
        lang = 'en',
        title = '',
        idCampaign,
        reason,
        email,
        link,
    } = req.body

    const campaign = await fetchCampaign({ _id: idCampaign })
    const idUser = '0' + req.user._id
    const idLink = req.params.id

    configureTranslation(lang)
    let reqReason = reason.map((str) => str)

    try {
        if (idUser !== campaign?.idNode) {
            return responseHandler.makeResponseError(res, 401, 'unauthorized')
        }

        const rejectedLink = await CampaignLink.findOneAndUpdate(
            { _id: idLink },
            {
                $set: {
                    status: 'rejected',
                    type: 'rejected',
                    reason: reqReason,
                },
            },
            { returnOriginal: false }
        )
        let id = +req.body.idUser
        const wallet = await Wallet.findOne({
            $or: [
                { 'keystore.address': rejectedLink.id_wallet.substring(2) },
                {
                    'walletV2.keystore.address':
                        rejectedLink.id_wallet.substring(2),
                },
            ],
        })
        const notificationPromise = notificationManager(
            !!wallet ? wallet.UserId : id,
            'cmp_candidate_reject_link',
            {
                cmp_name: campaign.title,
                action: 'link_rejected',
                cmp_link: link,
                cmp_hash: idCampaign,
                promHash: idLink,
            }
        )
        const emailPromise = readHTMLFileCampaign(
            __dirname + '/../public/emailtemplate/rejected_link.html',
            'rejectLink',
            title,
            email,
            idCampaign,
            reqReason
        )

        await Promise.all([notificationPromise, emailPromise])

        return responseHandler.makeResponseData(res, 200, 'success', {
            prom: rejectedLink.value,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}
const getIdUser = async (walletId) => {}
module.exports.updateStatistics = async (req, res) => {
    try {
        await updateStat()
        return responseHandler.makeResponseData(res, 200, 'success', false)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.coverByCampaign = async (req, res) => {
    try {
        let _id = req.params.id
        let campaign = await Campaigns.findOne({ _id }).lean()
        let image = Buffer.from(campaign.cover, 'base64')
        if (req.query.width && req.query.heigth)
            sharp(image)
                .resize(+req.query.heigth, +req.query.width)
                .toBuffer()
                .then((resizedImageBuffer) => {
                    res.writeHead(200, {
                        'Content-Type': 'image/png',
                        'Content-Length': resizedImageBuffer.length,
                    })
                    res.end(resizedImageBuffer)
                })
        else {
            res.writeHead(200, {
                'Content-Type': 'image/png',

                'Content-Length': image.length,
            })

            res.end(image)
        }
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.campaignsStatistics = async (req, res) => {
    try {
        let totalAbos = 0
        let totalViews = 0
        let totalPayed = new Big(0)
        let tvl = 0
        const decimalPower = new Big(10)

        const Crypto = await getPrices()

        const campaignProms = Campaigns.aggregate([
            {
                $project: basicAtt,
            },
            {
                $match: {
                    hash: { $exists: true },
                },
            },
        ]).allowDiskUse(true)

        const linkProms = CampaignLink.aggregate([
            {
                $match: {
                    id_campaign: { $exists: true },
                },
            },
        ]).allowDiskUse(true)

        const data = await Promise.all([campaignProms, linkProms])

        const [pools, links] = data

        // Convert the pools array to a Map for faster access
        const campaignMap = new Map(
            pools.map((campaign) => [campaign.hash, campaign])
        )

        for (let link of links) {
            const campaign = campaignMap.get(link.id_campaign)
            if (campaign) {
                if (link.abosNumber && link.abosNumber !== 'indisponible')
                    totalAbos += +link.abosNumber
                if (link.views) totalViews += +link.views

                if (link.payedAmount && link.payedAmount !== '0') {
                    let tokenName = ['SATTBEP20', 'WSATT'].includes(
                        campaign.token.name
                    )
                        ? 'SATT'
                        : campaign.token.name

                    const payedAmountInCryptoCurrency = new Big(
                        link.payedAmount
                    ).div(decimalPower.pow(getDecimal(tokenName) ?? 18))
                    const cryptoUnitPriceInUSD = new Big(
                        Crypto[tokenName].price
                    )
                    const tokenPriceInUSD =
                        payedAmountInCryptoCurrency.times(cryptoUnitPriceInUSD)
                    totalPayed = totalPayed.plus(tokenPriceInUSD)
                }
            }
        }

        for (let pool of pools) {
            if (pool.type === 'apply' && pool) {
                let campaignToken = pool.token.name
                if (
                    campaignToken === 'SATTBEP20' ||
                    campaignToken === 'SATTBTT'
                ) {
                    campaignToken = 'SATT'
                }

                tvl = new Big(tvl)
                    .plus(
                        new Big(pool.funds[1])
                            .div(decimalPower.pow(getDecimal(pool.token.name)))
                            .times(Crypto[campaignToken].price)
                    )
                    .toFixed(2)
            }
        }

        const SATT = Crypto['SATT']
        const result = {
            fully_diluted: SATT.fully_diluted,
            volume_24h: SATT.volume_24h,
            marketCap: SATT.market_cap,
            sattPrice: SATT.price,
            percentChange: SATT.percent_change_24h,
            nbPools: pools.length,
            reach: ((totalViews / totalAbos) * 100).toFixed(2),
            posts: links.length,
            views: totalViews,
            harvested: totalPayed.toFixed(),
            tvl,
        }

        return responseHandler.makeResponseData(res, 200, 'success', result)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.deleteDraft = async (req, res) => {
    try {
        let _id = req.params.id
        let idUser = req.user._id
        let campaign = await Campaigns.findOne({ _id })
        if (campaign.idNode !== '0' + idUser || campaign.type !== 'draft') {
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
module.exports.initStat = () => {
    return {
        total: 0,
        views: 0,
        likes: 0,
        shares: 0,
        accepted: 0,
        pending: 0,
        rejected: 0,
    }
}
module.exports.expandUrl = async (req, res) => {
    const shortUrl = req.query.shortUrl
    const options = {
        method: 'HEAD',
        url: shortUrl,
        maxRedirects: 5,
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        },
        agent: shortUrl.startsWith('https') ? https : http,
    }

    try {
        const response = await axios(options)
        const expandedUrl = response.request.res.responseUrl || shortUrl
        const parsedUrl = new URL(expandedUrl)

        return responseHandler.makeResponseData(res, 200, 'success', parsedUrl)
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

module.exports.statLinkCampaign = async (req, res) => {
    try {
        const id_campaign = req.params.hash
        const arrayOfUser = new Set()
        const arrayOfnbAbos = new Set()
        let nbTotalUser = 0
        let totalAbos = 0

        const result = {
            facebook: initStat(),
            twitter: initStat(),
            instagram: initStat(),
            youtube: initStat(),
            linkedin: initStat(),
            tiktok: initStat(),
            threads: initStat(),
        }

        const links = await CampaignLink.find({ id_campaign })

        for (let i = 0; i < links.length; i++) {
            const link = links[i]
            const { oracle } = link
            result[oracle] = calcSNStat(result[oracle], link)

            if (!arrayOfUser.has(link.id_wallet)) {
                nbTotalUser++
                arrayOfUser.add(link.id_wallet)
            }

            const abosKey = `${link.id_wallet}|${link.typeSN}`
            if (!arrayOfnbAbos.has(abosKey)) {
                if (link.abosNumber) {
                    totalAbos += parseInt(link.abosNumber, 10)
                }
                arrayOfnbAbos.add(abosKey)
            }
        }

        const responseData = {
            stat: result,
            creatorParticipate: nbTotalUser,
            reachTotal: totalAbos,
        }

        return responseHandler.makeResponseData(
            res,
            200,
            'success',
            responseData
        )
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message || err.error
        )
    }
}

module.exports.totalInvested = async (req, res) => {
    try {
        let prices = await getPrices()
        let sattPrice$ = prices.SATT.price
        let totalInvested = '0'
        let userCampaigns = await Campaigns.aggregate([
            {
                $project: basicAtt,
            },
            {
                $match: {
                    hash: { $exists: true },
                    idNode: '0' + req.user._id,
                },
            },
        ]).allowDiskUse(true)
        userCampaigns.forEach((elem) => {
            totalInvested = new Big(totalInvested).plus(new Big(elem.cost))
        })
        let totalInvestedUSD =
            sattPrice$ *
            parseFloat(new Big(totalInvested).div(etherInWei).toFixed(0))
        totalInvested = new Big(totalInvested).toFixed()

        return responseHandler.makeResponseData(res, 200, 'success', {
            totalInvestedUSD,
            totalInvested,
        })
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}

exports.generateBrief = async (req, res) => {
    try {
        const openIAURL = process.env.OPEN_IA_URL
        const apiKey = process.env.OPEN_IA_API_KEY
        const title = req.body.title
        const headers = {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey,
        }
        const body = {
            model: process.env.MODEL_GPT,
            messages: [
                {
                    role: process.env.ROLE_OPEN_IA,
                    content: process.env.PROMPT_OPEN_IA + title,
                },
            ],
            temperature: Number(process.env.TEMPERATURE_OPEN_IA),
        }
        const request = await axios.post(openIAURL, body, {
            headers,
        })
        return responseHandler.makeResponseData(
            res,
            200,
            'success',
            request.data
        )
    } catch (err) {
        return responseHandler.makeResponseError(
            res,
            500,
            err.message ? err.message : err.error
        )
    }
}
