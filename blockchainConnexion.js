var Web3 = require('web3')
const {
    web3UrlBep20,
    web3UrlBTT,
    web3Url,
    web3PolygonUrl,
    CampaignConstants,
    OracleConstants,
} = require('./conf/const')
const { Campaigns, Event } = require('./model/index')
const { TronConstant } = require('./conf/const')
const options = {
    timeout: 30000,

    clientConfig: {
        // Useful if requests are large
        maxReceivedFrameSize: 100000000, // bytes - default: 1MiB
        maxReceivedMessageSize: 100000000, // bytes - default: 8MiB

        // Useful to keep a connection alive
        keepalive: true,
        keepaliveInterval: 60000, // ms
    },

    // Enable auto reconnection
    reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false,
    },
}
exports.bep20Connexion = async () => {
    try {
        let Web3 = require('web3')
        let web3 = await new Web3(
            new Web3.providers.HttpProvider(web3UrlBep20, options)
        )
        await web3.eth.getNodeInfo()
        return web3
    } catch (err) {
        return null
    }
}

exports.erc20Connexion = async () => {
    try {
        let Web3 = require('web3')
        let web3 = await new Web3(
            new Web3.providers.HttpProvider(web3Url, options)
        )
        await web3.eth.getNodeInfo()
        return web3
    } catch (err) {
        return null
    }
}

exports.polygonConnexion = async () => {
    try {
        let Web3 = require('web3')
        let web3 = await new Web3(
            new Web3.providers.HttpProvider(web3PolygonUrl, options)
        )
        await web3.eth.getNodeInfo()
        return web3
    } catch (err) {
        return null
    }
}
exports.bttConnexion = async () => {
    try {
        let Web3 = require('web3')
        let web3 = await new Web3(
            new Web3.providers.HttpProvider(web3UrlBTT, options)
        )
        await web3.eth.getNodeInfo()
        return web3
    } catch (err) {
        return null
    }
}

exports.webTronInstance = async () => {
    try {
        const TronWeb = require('tronweb')
        const tronWeb = new TronWeb({
            fullHost: process.env.TRON_NETWORK_URL,
            headers: { 'TRON-PRO-API-KEY': process.env.TRON_PRO_API_KEY },
        })
        return tronWeb
    } catch (err) {}
}

exports.getContractByNetwork = async (credentials) => {
    try {
        var contract = new credentials.WEB3.eth.Contract(
            CampaignConstants[credentials.network.toUpperCase()].abi,
            CampaignConstants[credentials.network.toUpperCase()].address
        )
        contract.getGasPrice = credentials.WEB3.eth.getGasPrice

        return contract
    } catch (err) {}
}

exports.getCampaignContractByHashCampaign = async (
    hash,
    credentials = false,
    tronWeb = null
) => {
    try {
        var campaign = await Campaigns.findOne({ hash })
        if (campaign?.contract) {
            if (!!tronWeb) {
                let ctr = await tronWeb.contract(
                    TronConstant.campaign.abi,
                    TronConstant.campaign.address
                )
                return ctr
            }
            credentials.network = campaign.token.type
            return this.getContractByNetwork(credentials)
        }
    } catch (err) {}
}

exports.getPromContract = async (idProm, credentials = false) => {
    try {
        var prom = await Event.findOne(
            { prom: idProm },
            { contract: 1, _id: 0 }
        )

        return this.getContractByNetwork(credentials)
    } catch (err) {}
}

exports.getCampaignOwnerAddr = async (idProm) => {
    try {
        var prom = await Event.findOne(
            { prom: idProm },
            { contract: 1, _id: 0 }
        )
        if (!prom.contract) return

        return process.env.CAMPAIGN_OWNER
    } catch (err) {}
}

exports.getOracleContractByCampaignContract = async (credentials = false) => {
    try {
        var contract = new credentials.WEB3.eth.Contract(
            OracleConstants[credentials.network.toUpperCase()].abi,
            OracleConstants[credentials.network.toUpperCase()].address
        )
        contract.getGasPrice = credentials.WEB3.eth.getGasPrice

        return contract
    } catch (err) {}
}
