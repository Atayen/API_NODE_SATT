const { Wallet, User } = require('../model/index')
var fs = require('fs')
const {
    erc20Connexion,
    bep20Connexion,
    getContractByNetwork,
    getPromContract,
    polygonConnexion,
    bttConnexion,
    webTronInstance,
    artheraConnexion,
} = require('../blockchainConnexion')
const {
    web3UrlBep20,
    web3UrlBTT,
    web3Url,
    web3PolygonUrl,
    CampaignConstants,
    OracleConstants,
    ArtheraNetworkConstant,
} = require('../conf/const')
const { Campaigns } = require('../model/index')

const { wrapNative, getWalletTron, unWrapNative } = require('./wallets')

const {
    Constants,
    TronConstant,
    wrapConstants,
    PolygonNetworkConstant,
    BttNetworkConstant,
} = require('../conf/const')
const { config } = require('../conf/config')
const { timeout } = require('../helpers/utils')
const axios = require('axios')
const networks = [
    { name: 'ERC20', providerUrl: process.env.WEB3_URL },
    { name: 'BEP20', providerUrl: process.env.WEB3_URL_BEP20 },
    { name: 'POLYGON', providerUrl: process.env.WEB3_URL_POLYGON },
    { name: 'BTTC', providerUrl: process.env.WEB3_URL_BTT },
    { name: 'ARTHERA', providerUrl: process.env.WEB3_URL_ARTHERA },
]

const { getHttpProvider, networkProviders } = require('../web3/web3-connection')
const Web3 = require('web3')
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
exports.unlock = async (req, res) => {
    try {
        let UserId = req.user._id
        let pass = req.body.pass
        let account = await Wallet.findOne({ UserId })
        let Web3ETH = await erc20Connexion()
        let Web3BEP20 = await bep20Connexion()
        let Web3POLYGON = await polygonConnexion()
        const sdk = require('api')('@tron/v4.5.1#7p0hyl5luq81q')
        Web3ETH.eth.accounts.wallet.decrypt([account.keystore], pass)
        Web3BEP20.eth.accounts.wallet.decrypt([account.keystore], pass)
        Web3POLYGON.eth.accounts.wallet.decrypt([account.keystore], pass)
        return {
            address: '0x' + account.keystore.address,
            tronAddress: account.tronAddress,
            Web3ETH,
            Web3BEP20,
            Web3POLYGON,
            tronSdk: sdk,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.unlockArthera = async (req, res) => {
    try {
        let UserId = req.user._id
        let pass = req.body.pass
        let account = await Wallet.findOne({ UserId })
        let Web3ARTHERA = await artheraConnexion()
        Web3ARTHERA.eth.accounts.wallet.decrypt(
            [account.walletV2?.keystore],
            pass
        )

        return {
            address: '0x' + account.walletV2?.keystore.address,
            Web3ARTHERA,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}
//unlock networks
exports.unlockNetwork = async (req, res) => {
    try {
        let UserId = req.user._id
        let pass = req.body.pass
        let network = req.params.network?.toUpperCase()

        let wallet = await Wallet.findOne({ UserId })
        var web3
        var tronWeb
        if (network && network === 'TRON') {
            let privateKey = (await getWalletTron(req.user._id, req.body.pass))
                .priv
            tronWeb = await webTronInstance(privateKey)
            tronWeb.setPrivateKey(privateKey)
            let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
            tronWeb.setAddress(walletAddr)
            return {
                tronAddress: wallet.tronAddress,
                tronWeb,
                network,
            }
        } else if (network) {
            const provider = getHttpProvider(networkProviders[network])
            web3 = await new Web3(provider)
            web3.eth.accounts.wallet.decrypt([wallet.keystore], pass)
            return {
                address: '0x' + wallet.keystore.address,
                web3,
                network,
            }
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}
//approve camapaign
exports.approve = async (token, credentials, spender, amount, res) => {
    try {
        var contract =
            (!!credentials.tronWeb &&
                (await credentials.tronWeb.contract(
                    (!!token === TronConstant.token.wtrx &&
                        TronConstant.token.wtrxAbi) ||
                        TronConstant.token.abi,
                    token
                ))) ||
            new credentials.web3.eth.Contract(Constants.token.abi, token)

        var gasPrice =
            !credentials.tronWeb && (await credentials.web3.eth.getGasPrice())
        var gas =
            !credentials.tronWeb &&
            (await contract.methods
                .approve(spender, amount)
                .estimateGas({ from: credentials.address }))
        var receipt =
            (!!credentials.tronWeb &&
                (await contract
                    .approve(TronConstant.campaign.address, amount)
                    .send({
                        feeLimit: 100_000_000,
                        callValue: 0,
                        shouldPollResponse: false,
                    }))) ||
            (await contract.methods
                .approve(spender, amount)
                .send({
                    from: credentials.address,
                    gas: gas,
                    gasPrice: gasPrice,
                })
                .once('transactionHash', function (transactionHash) {}))
        if (!!credentials.tronWeb) {
            await timeout(10000)
            let result = await credentials.tronWeb.trx.getTransaction(receipt)
            if (result.ret[0].contractRet === 'SUCCESS') {
                return {
                    transactionHash: receipt,
                    address: credentials.tronAddress,
                    spender: spender,
                }
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        } else {
            return {
                transactionHash: receipt.transactionHash,
                address: credentials.address,
                spender: spender,
            }
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}
//allow campaign
exports.allow = async (token, address, spender, req) => {
    try {
        let network = req.params.network.toUpperCase()
        if (network === 'TRON') {
            let privateKey = (await getWalletTron(req.user._id, req.body.pass))
                .priv
            let tronWeb = await webTronInstance(privateKey)
            tronWeb.setPrivateKey(privateKey)
            let walletAddr = tronWeb.address.fromPrivateKey(privateKey)
            tronWeb.setAddress(walletAddr)

            let ctr = await tronWeb.contract(
                (!!token === TronConstant.token.wtrx &&
                    TronConstant.token.wtrxAbi) ||
                    TronConstant.token.abi,
                token
            )
            let amount = await ctr
                .allowance(walletAddr, TronConstant.campaign.address)
                .call()

            return { amount: tronWeb.BigNumber(amount._hex).toString() }
        } else {
            const provider = getHttpProvider(networkProviders[network])
            let web3 = await new Web3(provider)

            var contract = new web3.eth.Contract(Constants.token.abi, token)

            var amount = await contract.methods
                .allowance(address, spender)
                .call()
            return { amount: amount.toString() }
        }
    } catch (err) {
        return { amount: '0' }
    }
}
exports.bttApprove = async (token, address, spender) => {
    try {
        let Web3Btt = await bttConnexion()
        var contract = new Web3Btt.eth.Contract(Constants.token.abi, token)

        var amount = await contract.methods.allowance(address, spender).call()
        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.unlockBsc = async (req, res) => {
    try {
        let UserId = req.user._id
        let pass = req.body.pass
        let account = (await Wallet.findOne({ UserId })).walletV2
        let Web3BEP20 = await bep20Connexion()
        Web3BEP20.eth.accounts.wallet.decrypt([account.keystore], pass)
        return { address: '0x' + account.keystore.address, Web3BEP20 }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.unlockPolygon = async (req, res) => {
    try {
        let UserId = req.user._id
        let pass = req.body.pass
        let account = await Wallet.findOne({ UserId })
        let Web3POLYGON = await polygonConnexion()
        Web3POLYGON.eth.accounts.wallet.decrypt([account.keystore], pass)
        return { address: '0x' + account.keystore.address, Web3POLYGON }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.lock = async (credentials) => {
    if (!!credentials.Web3ETH)
        credentials.Web3ETH.eth.accounts.wallet.remove(credentials.address)
    if (!!credentials.Web3BEP20)
        credentials.Web3BEP20.eth.accounts.wallet.remove(credentials.address)
    if (!!credentials.Web3POLYGON)
        credentials.Web3POLYGON.eth.accounts.wallet.remove(credentials.address)
    if (!!credentials.web3UrlBTT)
        credentials.web3UrlBTT.eth.accounts.wallet.remove(credentials.address)
    if (!!credentials.web3ARTHERA)
        credentials.web3ARTHERA.eth.accounts.wallet.remove(credentials.address)
}
exports.lockNetwork = async (credentials) => {
    credentials.web3.eth.accounts.wallet.remove(credentials.address)
}

exports.lockERC20 = async (credentials) => {
    credentials.Web3ETH.eth.accounts.wallet.remove(credentials.address)
}

exports.lockBSC = async (credentials) => {
    credentials.Web3BEP20.eth.accounts.wallet.remove(credentials.address)
}

exports.lockPolygon = async (credentials) => {
    credentials.Web3POLYGON.eth.accounts.wallet.remove(credentials.address)
}

exports.getAccount = async (req, res) => {
    let UserId = req.user._id

    let account = await Wallet.findOne({ UserId })

    if (account) {
        var address = '0x' + account.keystore.address
        const [Web3ETH, Web3BEP20] = await Promise.all([
            erc20Connexion(),
            bep20Connexion(),
        ])
        var ether_balance = Web3ETH.eth.getBalance(address)

        var bnb_balance = Web3BEP20.eth.getBalance(address)

        contractSatt = new Web3ETH.eth.Contract(
            Constants.token.abi,
            Constants.token.satt
        )

        var satt_balance = await contractSatt.methods.balanceOf(address).call()

        var result = {
            address: '0x' + account.keystore.address,
            ether_balance: ether_balance,
            bnb_balance: bnb_balance,
            satt_balance: satt_balance ? satt_balance.toString() : 0,
            version: account.mnemo ? 2 : 1,
        }
        result.btc_balance = 0
        if (
            process.env.NODE_ENV === 'mainnet' &&
            account.btc &&
            account.btc.addressSegWitCompat
        ) {
            result.btc = account.btc.addressSegWitCompat

            try {
                var utxo = JSON.parse(
                    child.execSync(
                        process.env.BTC_CMD +
                            ' listunspent 1 1000000 \'["' +
                            account.btc.addressSegWitCompat +
                            '"]\''
                    )
                )

                if (!utxo.length) result.btc_balance = '0'
                else {
                    var red = utxo.reduce(function (r, cur) {
                        r.amount += parseFloat(cur.amount)
                        return r
                    })
                    result.btc_balance = Math.floor(red.amount * 100000000)
                }
            } catch (e) {
                result.btc_balance = 0
            }
        }

        return result
    } else {
        return res.status(401).end('Account not found')
    }
}

exports.isNativeAddr = (addr) => {
    return addr == Constants.token.matic || addr == null
}

exports.isWrappedAddr = (addr) => {
    return (
        addr == wrapConstants[BttNetworkConstant].address ||
        addr == wrapConstants[PolygonNetworkConstant].address
    )
}

exports.createPerformanceCampaign = async (
    dataUrl,
    startDate,
    endDate,
    ratios,
    token,
    amount,
    credentials,
    tronWeb,
    res,
    limit = 100,
    network
) => {
    try {
        /**   CHECK IF COMPAGNE NETWORK IS TRON */
        if (tronWeb !== null && tronWeb !== undefined) {
            /**  GET CAMPAGNE CONTRACT */
            const contract = await tronWeb.contract(
                TronConstant.campaign.abi,
                TronConstant.campaign.address
            )

            /**   CALL METHOD CREATE PRICE FUND ALL FROM CONTRACT*/
            const transactionReceipt = await contract
                .createPriceFundAll(
                    dataUrl,
                    startDate,
                    endDate,
                    ratios,
                    token,
                    amount,
                    limit || 100
                )
                .send({
                    feeLimit: 1e9,
                    callValue: 0,
                    shouldPollResponse: false,
                })

            await timeout(10000)

            /**  CHECK TRANSACTION STATUS  */
            const result = await tronWeb.trx.getUnconfirmedTransactionInfo(
                transactionReceipt
            )

            if (result.receipt.result === 'SUCCESS') {
                return {
                    transactionHash: receipt,
                    hash: '0x' + result.log[0].topics[1],
                }
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }

        /** CHECK TOKEN IS NATIVE OR NO (BNB for BEP20 / ETH for ERC20 ) */
        if (this.isNativeAddr(token)) {
            token =
                network === 'ARTHERA'
                    ? process.env.CONST_WAA
                    : wrapConstants[credentials.network].address
            if (network === 'ARTHERA') {
                tokenSmartContract = new credentials.Web3ARTHERA.eth.Contract(
                    wrapConstants[ArtheraNetworkConstant].abi,
                    wrapConstants[ArtheraNetworkConstant].address
                )

                let gasPrice = await credentials.Web3ARTHERA.eth.getGasPrice()
                let gas = await tokenSmartContract.methods
                    .deposit()
                    .estimateGas({
                        from: credentials.address,
                        value: amount,
                        gasPrice,
                    })

                let receipt = await tokenSmartContract.methods.deposit().send({
                    from: credentials.address,
                    value: amount,
                    gas,
                    gasPrice,
                })
            } else await wrapNative(amount, credentials)
        }

        /** GET CONTRACT  */
        let contract

        if (network === 'ARTHERA') {
            contract = new credentials.Web3ARTHERA.eth.Contract(
                CampaignConstants[ArtheraNetworkConstant].abi,
                CampaignConstants[ArtheraNetworkConstant].address
            )
        } else contract = await getContractByNetwork(credentials)

        /** GET GAS PRICE  */
        const gasPrice =
            network === 'ARTHERA'
                ? await credentials.Web3ARTHERA.eth.getGasPrice()
                : await contract.getGasPrice()

        /** GET GAS LIMIT FROM .env */
        const gas =
            network === 'ARTHERA'
                ? process.env.GAS_LIMIT_ARTHERA
                : process.env.GAS_LIMIT

        /**   CALL METHOD CREATE PRICE FUND ALL FROM CONTRACT*/
        const transactionReceipt = await contract.methods
            .createPriceFundAll(
                dataUrl,
                startDate,
                endDate,
                ratios,
                token,
                amount + '',
                limit || 100
            )
            .send({
                from: credentials.address,
                gas: gas,
                gasPrice: gasPrice,
            })

        transactionReceipt.transactionHash
        return {
            hash: transactionReceipt.events.CampaignCreated.returnValues.id,
            transactionHash:
                transactionReceipt.events.CampaignCreated.transactionHash,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.createBountiesCampaign = async (
    dataUrl,
    startDate,
    endDate,
    bounties,
    token,
    amount,
    credentials,
    tronWeb,
    res,
    limit = 0,
    network
) => {
    if (!!tronWeb) {
        let ctr = await tronWeb.contract(
            TronConstant.campaign.abi,
            TronConstant.campaign.address
        )

        let receipt = await ctr
            .createPriceFundBounty(
                dataUrl,
                startDate,
                endDate,
                bounties,
                token,
                amount,
                limit || 100
            )
            .send({
                feeLimit: 1e9,
                callValue: 0,
                shouldPollResponse: false,
            })

        await timeout(10000)

        let result = await tronWeb.trx.getUnconfirmedTransactionInfo(receipt)

        if (result.receipt.result === 'SUCCESS') {
            return {
                transactionHash: receipt,
                hash: '0x' + result.log[0].topics[1],
            }
        } else {
            res.status(500).send({
                code: 500,
                error: result,
            })
        }
    }

    if (this.isNativeAddr(token)) {
        token =
            network === 'ARTHERA'
                ? process.env.CONST_WAA
                : wrapConstants[credentials.network].address
        if (network === 'ARTHERA') {
            tokenSmartContract = new credentials.Web3ARTHERA.eth.Contract(
                wrapConstants[ArtheraNetworkConstant].abi,
                wrapConstants[ArtheraNetworkConstant].address
            )

            let gasPrice = await credentials.Web3ARTHERA.eth.getGasPrice()
            let gas = await tokenSmartContract.methods.deposit().estimateGas({
                from: credentials.address,
                value: amount,
                gasPrice,
            })

            let receipt = await tokenSmartContract.methods.deposit().send({
                from: credentials.address,
                value: amount,
                gas,
                gasPrice,
            })
        } else await wrapNative(amount, credentials)
    }
    let ctr

    if (network === 'ARTHERA') {
        ctr = new credentials.Web3ARTHERA.eth.Contract(
            CampaignConstants[ArtheraNetworkConstant].abi,
            CampaignConstants[ArtheraNetworkConstant].address
        )
    } else ctr = await getContractByNetwork(credentials)
    // var ctr = await getContractByNetwork(credentials)
    var gasPrice =
        network === 'ARTHERA'
            ? await credentials.Web3ARTHERA.eth.getGasPrice()
            : await ctr.getGasPrice()
    /** GET GAS LIMIT FROM .env */
    var gas =
        network === 'ARTHERA'
            ? process.env.GAS_LIMIT_ARTHERA
            : process.env.GAS_LIMIT

    try {
        var receipt = await ctr.methods
            .createPriceFundBounty(
                dataUrl,
                startDate,
                endDate,
                bounties,
                token,
                amount,
                limit || 100
            )
            .send({
                from: credentials.address,
                gas: gas,
                gasPrice: gasPrice,
            })
        let transactionHash = receipt.events.CampaignCreated.transactionHash
        transactionHash
        return {
            hash: receipt.events.CampaignCreated.returnValues.id,
            transactionHash,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}
exports.artheraApprove = async (token, address, spender) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['ARTHERA'].address
        let Web3Arthera = await artheraConnexion()
        var contract = new Web3Arthera.eth.Contract(Constants.token.abi, token)
        var amount = await contract.methods.allowance(address, spender).call()
        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.bttApprove = async (token, address, spender) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['BTTC'].address
        let Web3Btt = await bttConnexion()
        var contract = new Web3Btt.eth.Contract(Constants.token.abi, token)

        var amount = await contract.methods.allowance(address, spender).call()
        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.tronApprove = async (walletAddr, tronWeb, token, res) => {
    try {
        let ctr = await tronWeb.contract(
            (!!token === TronConstant.token.wtrx &&
                TronConstant.token.wtrxAbi) ||
                TronConstant.token.abi,
            token
        )
        let amount = await ctr
            .allowance(walletAddr, TronConstant.campaign.address)
            .call()

        return { amount: tronWeb.BigNumber(amount._hex).toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.bep20Allow = async (token, credentials, spender, amount, res) => {
    try {
        var contract = new credentials.Web3BEP20.eth.Contract(
            Constants.token.abi,
            token
        )
        var gasPrice = await credentials.Web3BEP20.eth.getGasPrice()
        var gas = await contract.methods
            .approve(spender, amount)
            .estimateGas({ from: credentials.address })
        var receipt = await contract.methods
            .approve(spender, amount)
            .send({ from: credentials.address, gas: gas, gasPrice: gasPrice })
            .once('transactionHash', function (transactionHash) {})

        return {
            transactionHash: receipt.transactionHash,
            address: credentials.address,
            spender: spender,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.bep20Approve = async (token, address, spender) => {
    try {
        let Web3BEP20 = await bep20Connexion()
        var contract = new Web3BEP20.eth.Contract(Constants.token.abi, token)
        var amount = await contract.methods.allowance(address, spender).call()
        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.polygonAllow = async (token, credentials, spender, amount, res) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['POLYGON'].address
        var contract = new credentials.Web3POLYGON.eth.Contract(
            Constants.token.abi,
            token
        )
        var gasPrice = await credentials.Web3POLYGON.eth.getGasPrice()
        var gas = await contract.methods
            .approve(spender, amount)
            .estimateGas({ from: credentials.address })
        var receipt = await contract.methods
            .approve(spender, amount)
            .send({ from: credentials.address, gas: gas, gasPrice: gasPrice })
            .once('transactionHash', function (transactionHash) {})

        return {
            transactionHash: receipt.transactionHash,
            address: credentials.address,
            spender: spender,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.bttAllow = async (token, credentials, spender, amount, res) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['BTTC'].address
        var contract = new credentials.web3UrlBTT.eth.Contract(
            Constants.token.abi,
            token
        )
        var gasPrice = await credentials.web3UrlBTT.eth.getGasPrice()
        var gas = await contract.methods
            .approve(spender, amount)
            .estimateGas({ from: credentials.address })
        var receipt = await contract.methods
            .approve(spender, amount)
            .send({ from: credentials.address, gas: gas, gasPrice: gasPrice })
            .once('transactionHash', function (transactionHash) {})

        return {
            transactionHash: receipt.transactionHash,
            address: credentials.address,
            spender: spender,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.artheraAllow = async (token, credentials, spender, amount, res) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['ARTHERA'].address
        var contract = new credentials.Web3ARTHERA.eth.Contract(
            Constants.token.abi,
            token
        )
        var gasPrice = await credentials.Web3ARTHERA.eth.getGasPrice()
        var gas = await contract.methods
            .approve(spender, amount)
            .estimateGas({ from: credentials.address })
        var receipt = await contract.methods
            .approve(spender, amount)
            .send({ from: credentials.address, gas: gas, gasPrice: gasPrice })
            .once('transactionHash', function (transactionHash) {})

        return {
            transactionHash: receipt.transactionHash,
            address: credentials.address,
            spender: spender,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}
exports.tronAllowance = async (tronWeb, token, amount, res) => {
    try {
        let ctr = await tronWeb.contract(
            (!!token === TronConstant.token.wtrx &&
                TronConstant.token.wtrxAbi) ||
                TronConstant.token.abi,
            token
        )
        let receipt = await ctr
            .approve(TronConstant.campaign.address, amount)
            .send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: false,
            })
        await timeout(10000)
        let result = await tronWeb.trx.getTransaction(receipt)
        if (result.ret[0].contractRet === 'SUCCESS') {
            return {
                transactionHash: receipt,
            }
        } else {
            res.status(500).send({
                code: 500,
                error: result,
            })
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.polygonApprove = async (token, address, spender) => {
    try {
        if (this.isNativeAddr(token)) token = wrapConstants['POLYGON'].address
        let Web3POLYGON = await polygonConnexion()
        var contract = new Web3POLYGON.eth.Contract(Constants.token.abi, token)
        var amount = await contract.methods.allowance(address, spender).call()

        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.erc20Allow = async (token, credentials, spender, amount, res) => {
    try {
        var contract = new credentials.Web3ETH.eth.Contract(
            Constants.token.abi,
            token
        )
        var gasPrice = await credentials.Web3ETH.eth.getGasPrice()
        var gas = await contract.methods
            .approve(spender, amount)
            .estimateGas({ from: credentials.address })
        var receipt = await contract.methods
            .approve(spender, amount)
            .send({ from: credentials.address, gas: gas, gasPrice: gasPrice })
            .once('transactionHash', (transactionHash) => {})

        return {
            transactionHash: receipt.transactionHash,
            address: credentials.address,
            spender: spender,
        }
    } catch (err) {
        res.status(500).send({
            code: 500,
            error: err.message ? err.message : err.error,
        })
    }
}

exports.erc20Approve = async (token, address, spender) => {
    try {
        let Web3ETH = await erc20Connexion()
        var contract = new Web3ETH.eth.Contract(Constants.token.abi, token)
        var amount = await contract.methods.allowance(address, spender).call()

        return { amount: amount.toString() }
    } catch (err) {
        return { amount: '0' }
    }
}

exports.sortOutPublic = (req, idNode, strangerDraft) => {
    const title = req.query.searchTerm || ''
    const status = req.query.status
    const blockchainType = req.query.blockchainType || ''

    const dateJour = Math.round(new Date().getTime() / 1000)
    if (req.query._id) query['$and'].push({ _id: { $gt: req.query._id } })

    const remainingBudget = req.query.remainingBudget || []

    var query = {}
    query['$and'] = []

    if (
        (req.query.idWallet || req.query.showOnlyMyCampaigns) &&
        !req.query.showOnlyLiveCampaigns
    )
        query['$and'].push({ _id: { $nin: strangerDraft } })

    req.query.showOnlyMyCampaigns && query['$and'].push({ idNode })
    req.query.showOnlyLiveCampaigns &&
        query['$and'].push({ type: 'apply', hash: { $exists: true } })
    !req.query.idWallet && query['$and'].push({ hash: { $exists: true } })
    req.query.remuneration &&
        query['$and'].push({ remuneration: req.query.remuneration })

    if (req.query.oracles == undefined) {
        oracles = ['twitter', 'facebook', 'youtube', 'instagram', 'linkedin']
    } else if (typeof req.query.oracles === 'string') {
        oracles = Array(req.query.oracles)
    } else {
        oracles = req.query.oracles
    }
    if (req.query.oracles)
        query['$and'].push({
            $or: [
                { 'ratios.oracle': { $in: oracles } },
                { 'bounties.oracle': { $in: oracles } },
            ],
        })

    title &&
        query['$and'].push({
            title: { $regex: '.*' + title + '.*', $options: 'i' },
        })
    blockchainType && query['$and'].push({ 'token.type': blockchainType })

    if (status == 'active') {
        if (remainingBudget.length == 2) {
            query['$and'].push({ 'funds.1': { $exists: true } })
            query['$and'].push({
                'funds.1': {
                    $gte: remainingBudget[0],
                    $lte: remainingBudget[1],
                },
            })
        }
        query['$and'].push({ endDate: { $gt: dateJour } })
        query['$and'].push({ 'funds.1': { $ne: '0' } })
        query['$and'].push({ hash: { $exists: true } })
    } else if (status == 'finished') {
        query['$and'].push({
            $or: [{ endDate: { $lt: dateJour } }, { 'funds.1': { $eq: '0' } }],
        })
        query['$and'].push({ hash: { $exists: true } })
    } else if (status == 'draft') {
        query['$and'].push({ hash: { $exists: false } })
        query['$and'].push({ idNode: idNode })
    }

    query['$and'].push({
        type: {
            $in: ['draft', 'finished', 'inProgress', 'apply'],
        },
    })

    return query
}

exports.getUserIdByWallet = async (wallet) => {
    let user = await Wallet.findOne(
        {
            $or: [
                { 'walletV2.keystore.address': wallet },
                { 'keystore.address': wallet },
            ],
        },
        { UserId: 1 }
    ).lean()
    return user?.UserId
}

exports.getLinkedinLinkInfo = async (
    accessToken,
    activityURN,
    linkedinProfile
) => {
    try {
        const params = new URLSearchParams()
        params.append('client_id', process.env.LINKEDIN_KEY)
        params.append('client_secret', process.env.LINKEDIN_SECRET)
        params.append('token', accessToken)

        let tokenValidityBody = await axios.post(
            'https://www.linkedin.com/oauth/v2/introspectToken',
            params
        )
        if (!tokenValidityBody.data?.active) {
            let accessTokenUrl = `https://www.linkedin.com/oauth/v2/accessToken?grant_type=refresh_token&refresh_token=${linkedinProfile.refreshToken}&client_id=${process.env.LINKEDIN_KEY}&client_secret=${process.env.LINKEDIN_SECRET}`
            let resAccessToken = (await axios.get(accessTokenUrl)).data
            accessToken = resAccessToken.access_token
        }
        let linkInfo = {}

        let postData = (
            await axios.get(config.linkedinActivityUrl(activityURN), {
                headers: { Authorization: 'Bearer ' + accessToken },
            })
        ).data
        let urn = `urn:li:activity:${activityURN}`
        linkInfo.idUser =
            postData.results[urn]['domainEntity~'].owner ??
            postData.results[urn]['domainEntity~'].author
        linkInfo.idPost = postData.results[urn]['domainEntity']
        if (postData.results[urn]['domainEntity~'].content)
            linkInfo.mediaUrl =
                postData.results[urn][
                    'domainEntity~'
                ].content.contentEntities[0].entityLocation
        return linkInfo
    } catch (err) {}
}

exports.getLinkedinLinkInfoMedia = async (
    accessToken,
    shareURN,
    linkedinProfile
) => {
    try {
        const params = new URLSearchParams()
        params.append('client_id', process.env.LINKEDIN_KEY)
        params.append('client_secret', process.env.LINKEDIN_SECRET)
        params.append('token', accessToken)

        let tokenValidityBody = await axios.post(
            'https://www.linkedin.com/oauth/v2/introspectToken',
            params
        )
        if (!tokenValidityBody.data?.active) {
            let accessTokenUrl = `https://www.linkedin.com/oauth/v2/accessToken?grant_type=refresh_token&refresh_token=${linkedinProfile.refreshToken}&client_id=${process.env.LINKEDIN_KEY}&client_secret=${process.env.LINKEDIN_SECRET}`
            let resAccessToken = (await axios.get(accessTokenUrl)).data
            accessToken = resAccessToken.access_token
        }
        let linkInfo = {}

        let postData = (
            await axios.get(config.linkedinShareUrl(shareURN), {
                headers: { Authorization: 'Bearer ' + accessToken },
            })
        ).data
        let urn = shareURN
        linkInfo.idUser =
            postData.results[urn].owner ?? postData.results[urn].author
        linkInfo.idPost = postData.results[urn].id
        if (postData.results[urn].content)
            linkInfo.mediaUrl =
                postData.results[urn].content.contentEntities[0].entityLocation
        return linkInfo
    } catch (err) {}
}

exports.applyCampaign = async (
    idCampaign,
    typeSN,
    idPost,
    idUser,
    cred,
    tronWeb,
    token,
    abos
) => {
    try {
        if (!!tronWeb) {
            let ctr = await tronWeb.contract(
                TronConstant.campaign.abi,
                TronConstant.campaign.address
            )
            let receipt = await ctr
                .applyCampaign(idCampaign, typeSN, idPost, idUser)
                .send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false,
                })

            await timeout(10000)

            let result = await tronWeb.trx.getUnconfirmedTransactionInfo(
                receipt
            )

            if (result.receipt.result === 'SUCCESS') {
                return {
                    transactionHash: receipt,
                    idCampaign: idCampaign,
                    typeSN: typeSN,
                    idPost: idPost,
                    idUser: idUser,
                    idProm: '0x' + result.log[0].topics[2],
                }
            } else if (result.receipt.result === 'OUT_OF_ENERGY') {
                return {
                    code: 401,
                    error: 'OUT_OF_ENERGY',
                }
            } else {
                return {
                    code: 500,
                    error: result,
                }
            }
        }

        let web3 = await getContractByNetwork(cred)

        var gas = 400000
        // var gas = await web3.methods
        //     .applyCampaign(idCampaign, typeSN, idPost, idUser, abos)
        //     .estimateGas({
        //         from: cred.address,
        //         gasPrice: gasPrice,
        //     })

        var gasPrice = await web3.getGasPrice()

        var receipt = await web3.methods
            .applyCampaign(idCampaign, typeSN, idPost, idUser, abos)
            .send({
                from: cred.address,
                gas: gas,
                gasPrice: gasPrice,
            })

        let prom = receipt.events.CampaignApplied.returnValues.prom
        receipt.events.CampaignApplied.transactionHash

        return {
            transactionHash: receipt.events.CampaignApplied.transactionHash,
            idCampaign: idCampaign,
            typeSN: typeSN,
            idPost: idPost,
            idUser: idUser,
            idProm: prom,
        }
    } catch (err) {
        return { error: err.message }
    }
}

exports.getRemainingFunds = async (hash, credentials, advertiser = null) => {
    try {
        var gas = 200000
        var ctr = await getContractByNetwork(credentials)
        var gasPrice = await ctr.getGasPrice()
        var receipt = await ctr.methods.getRemainingFunds(hash).send({
            from: credentials.address,
            gas,
            gasPrice,
        })

        await Campaigns.updateOne({ hash: hash }, { $set: { retrieved: true } })
        return {
            transactionHash: receipt.transactionHash,
            hash,
            ...(advertiser && { advertiser }),
        }
    } catch (err) {
        console.error(err)
    }
}

exports.getReachLimit = async (campaignRatio, oracle) => {
    let ratio = campaignRatio.find((item) => item.oracle == oracle)
    if (ratio) return ratio.reachLimit
    return
}

exports.fundCampaign = async (idCampaign, token, amount, credentials) => {
    try {
        var ctr = await getContractByNetwork(credentials)
        var gasPrice = await ctr.getGasPrice()
        var gas = 200000

        var receipt = await ctr.methods
            .fundCampaign(idCampaign, token, amount)
            .send({
                from: credentials.address,
                gas: gas,
                gasPrice: gasPrice,
            })
        receipt.transactionHash
        return {
            transactionHash: receipt.transactionHash,
            idCampaign: idCampaign,
            token: token,
            amount: amount,
        }
    } catch (err) {}
}

exports.getGains = async (
    idProm,
    credentials,
    tronWeb,
    token = false,
    network
) => {
    if (!!tronWeb) {
        let ctr = await tronWeb.contract(
            TronConstant.campaign.abi,
            TronConstant.campaign.address
        )
        let receipt = await ctr.getGains(idProm, !!tronWeb.wrappedTrx).send({
            feeLimit: 100_000_000,
            callValue: 0,
            shouldPollResponse: false,
        })
        await timeout(10000)
        let result = await tronWeb.trx.getTransaction(receipt)

        if (result.ret[0].contractRet === 'SUCCESS') {
            return {
                transactionHash: receipt,
                idProm: idProm,
            }
        }
        return
    }
    let ctr
    if (network === 'ARTHERA') {
        ctr = new credentials.Web3ARTHERA.eth.Contract(
            CampaignConstants[ArtheraNetworkConstant].abi,
            CampaignConstants[ArtheraNetworkConstant].address
        )
    } else ctr = await getPromContract(idProm, credentials)
    var gas = 200000
    var gasPrice =
        network === 'ARTHERA'
            ? await credentials.Web3ARTHERA.eth.getGasPrice()
            : await ctr.getGasPrice()
    var receipt = await ctr.methods.getGains(idProm).send({
        from: credentials.address,
        gas: gas,
        gasPrice: gasPrice,
    })

    if (this.isNativeAddr(token)) {
        await unWrapNative(credentials)
    }

    return {
        transactionHash: receipt.transactionHash,
        idProm: idProm,
    }
}

exports.filterLinks = (req, id_wallet) => {
    let { oracles, status, campaign, state } = req.query

    var query = { id_wallet }
    if (campaign && state === 'part') {
        query = { id_wallet, id_campaign: campaign }
    } else if (campaign && state === 'owner') query = { id_campaign: campaign }
    else if (!campaign && !state) query = { id_wallet: id_wallet }

    if (oracles)
        query.oracle = { $in: Array.isArray(oracles) ? oracles : [oracles] }

    if (status == 'false') {
        query.status = false
        query.type = 'waiting_for_validation'
    } else {
        if (status == 'rejected') query.status = 'rejected'
        if (status == 'true') query.status = true
        query.type = {
            $in: [
                'indisponible',
                'waiting_for_validation',
                'harvest',
                'already_recovered',
                'not_enough_budget',
                'no_gains',
                'rejected',
                'none',
            ],
        }
    }
    return query
}

exports.influencersLinks = async (links, tronWeb = null) => {
    try {
        // let idproms = await ctr.methods.getProms(idCampaign).call();
        let proms = links

        if (links.length) {
            let addresses = []
            let ids = []
            let idByAddress = []
            let userById = []

            for (let i = 0; i < links.length; i++) {
                if (addresses.indexOf(links[i].id_wallet) == -1)
                    addresses.push(
                        (!!tronWeb && links[i].id_wallet) ||
                            links[i].id_wallet.slice(2).toLowerCase()
                    )
            }

            let wallets =
                (!!tronWeb &&
                    (await Wallet.find({
                        tronAddress: { $in: addresses },
                    }))) ||
                (await Wallet.find({
                    'keystore.address': { $in: addresses },
                }))

            for (let i = 0; i < wallets.length; i++) {
                idByAddress[
                    (!!tronWeb && wallets[i].tronAddress) ||
                        '0x' + wallets[i].keystore?.address
                ] = 'id#' + wallets[i].UserId
                if (ids.indexOf(wallets[i].UserId) == -1)
                    ids.push(wallets[i].UserId)
            }
            let users = await User.find({ _id: { $in: ids } }).select({
                email: 1,
                _id: 1,
                picLink: 1,
                lastName: 1,
                firstName: 1,
            })

            for (let i = 0; i < users.length; i++) {
                userById['id#' + users[i]._id] = users[i]
            }
            for (let i = 0; i < proms.length; i++) {
                proms[i].meta =
                    userById[
                        (!!tronWeb && idByAddress[proms[i].id_wallet]) ||
                            idByAddress[proms[i].id_wallet.toLowerCase()]
                    ]
            }
        }
        return proms
    } catch (err) {}
}

exports.updateBounty = async (idProm, credentials, tronWeb, network) => {
    try {
        if (!!tronWeb) {
            let ctr = await tronWeb.contract(
                TronConstant.campaign.abi,
                TronConstant.campaign.address
            )
            let receipt = await ctr.updateBounty(idProm).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: false,
            })

            await timeout(10000)
            let result = await tronWeb.trx.getUnconfirmedTransactionInfo(
                receipt
            )

            if (result.receipt.result === 'SUCCESS') {
                return {
                    transactionHash: receipt,
                    idProm: idProm,
                    events: [
                        {
                            result: {
                                idRequest: '0x' + result.log[0].topics[1],
                            },
                        },
                    ], //TODO add events to returned value
                }
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }
        var gas = 200000
        let ctr
        if (network === 'ARTHERA') {
            ctr = new credentials.Web3ARTHERA.eth.Contract(
                CampaignConstants[ArtheraNetworkConstant].abi,
                CampaignConstants[ArtheraNetworkConstant].address
            )
        } else ctr = await getContractByNetwork(credentials)
        var gasPrice =
            network === 'ARTHERA'
                ? await credentials.Web3ARTHERA.eth.getGasPrice()
                : await ctr.getGasPrice()

        var receipt = await ctr.methods.updateBounty(idProm).send({
            from: credentials.address,
            gas: gas,
            gasPrice: gasPrice,
        })
        return {
            transactionHash: receipt.transactionHash,
            idProm: idProm,
            events: receipt.events,
        }
    } catch (err) {}
}

exports.validateProm = async (
    id_campaign,
    typeSN,
    idPost,
    idUser,
    abosNumber,
    ownerLink,
    messageHash,
    v,
    r,
    s,
    credentials,
    tronWeb,
    network
) => {
    if (!!tronWeb) {
        let ctr = await tronWeb.contract(
            TronConstant.campaign.abi,
            TronConstant.campaign.address
        )
        let receipt = await ctr.validateProm(idProm).send({
            feeLimit: 100_000_000,
            callValue: 0,
            shouldPollResponse: false,
        })
        await timeout(10000)
        let result = await tronWeb.trx.getTransaction(receipt)
        if (result.ret[0].contractRet === 'SUCCESS') {
            return {
                transactionHash: receipt,
                idProm: idProm,
            }
        } else return result
    }
    var gas = 1000000
    let ctr
    if (network === 'ARTHERA') {
        ctr = new credentials.Web3ARTHERA.eth.Contract(
            CampaignConstants[ArtheraNetworkConstant].abi,
            CampaignConstants[ArtheraNetworkConstant].address
        )
    } else ctr = await getContractByNetwork(credentials)
    var gasPrice =
        network === 'ARTHERA'
            ? await credentials.Web3ARTHERA.eth.getGasPrice()
            : await ctr.getGasPrice()

    var receipt = await ctr.methods
        .validateProm(
            id_campaign,
            typeSN,
            idPost,
            idUser,
            abosNumber,
            ownerLink,
            messageHash,
            v,
            r,
            s
        )
        .send({
            from: credentials.address,
            gas: gas,
            gasPrice: gasPrice,
        })

    return {
        transactionHash: receipt.transactionHash,
        prom: receipt.events.PromAccepted.returnValues.id,
    }
}

exports.updatePromStats = async (
    idProm,
    credentials,
    tronWeb,
    res = null,
    network
) => {
    try {
        if (!!tronWeb) {
            let ctr = await tronWeb.contract(
                TronConstant.campaign.abi,
                TronConstant.campaign.address
            )
            let receipt = await ctr.updatePromStats(/*'0x' +*/ idProm).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: false,
            })

            await timeout(10000)
            let result = await tronWeb.trx.getUnconfirmedTransactionInfo(
                receipt
            )

            if (result.receipt.result === 'SUCCESS') {
                return {
                    transactionHash: receipt,
                    idProm: idProm,
                    events: [
                        {
                            result: {
                                idRequest: '0x' + result.log[0].topics[1],
                            },
                        },
                    ], //TODO add events to returned value
                }
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }
        var gas = 200000
        var ctr

        if (network === 'ARTHERA') {
            ctr = new credentials.Web3ARTHERA.eth.Contract(
                CampaignConstants[ArtheraNetworkConstant].abi,
                CampaignConstants[ArtheraNetworkConstant].address
            )
        } else ctr = await getContractByNetwork(credentials)

        var gasPrice =
            network === 'ARTHERA'
                ? await credentials.Web3ARTHERA.eth.getGasPrice()
                : await ctr.getGasPrice()
        var receipt = await ctr.methods.updatePromStats(idProm).send({
            from: credentials.address,
            gas: gas,
            gasPrice: gasPrice,
        })

        return {
            transactionHash: receipt.transactionHash,
            idProm: idProm,
            events: receipt.events,
        }
    } catch (err) {
        return { error: err }
    }
}

exports.getTransactionAmount = async (
    credentials,
    type,
    transactionHash,
    network
) => {
    try {
        if (type === 'TRON') {
            let result = await tronWeb.trx.getUnconfirmedTransactionInfo(
                transactionHash
            )
            let amount = tronWeb.toDecimal('0x' + result.log[1].data)
            return amount
        }
        let data = await network.eth.getTransactionReceipt(transactionHash)
        let amount = type === 'BTTC' ? data.logs[1].data : data.logs[0].data
        let hex = network.utils.hexToNumberString(amount)
        return hex
    } catch (e) {}
}

exports.getProviderUrl = async (networkName) => {
    const network = networks.find((net) => net.name === networkName)
    return network ? network.providerUrl : null
}

exports.getTransactionAmountExternal = async (
    credentials,
    type,
    transactionHash,
    network
) => {
    try {
        let web3 = await new Web3(
            new Web3.providers.HttpProvider(
                await exports.getProviderUrl(network),
                options
            )
        )
        await new Promise((resolve) => setTimeout(resolve, 15000))

        let data = await new web3.eth.getTransactionReceipt(transactionHash)

        let amount = type === 'BTTC' ? data.logs[1].data : data.logs[0].data
        let hex = web3.utils.hexToNumberString(amount)
        return hex
    } catch (e) {
        console.log('error', e)
    }
}

exports.campaignStatus = (campaign) => {
    try {
        let type = ''
        let dateNow = Math.floor(new Date().getTime() / 1000)

        campaign.startDate =
            typeof campaign.startDate == 'number'
                ? campaign.startDate
                : Math.floor(new Date(campaign.startDate).getTime() / 1000)
        campaign.endDate =
            typeof campaign.endDate == 'number'
                ? campaign.endDate
                : Math.floor(new Date(campaign.endDate).getTime() / 1000)

        let isFinished =
            dateNow > campaign.endDate ||
            (campaign.funds && campaign.funds[1] == '0')
        if (!campaign.hash) type = 'draft'
        else if (isFinished && campaign.hash) type = 'finished'
        else if (campaign.hash && dateNow < campaign.startDate)
            type = 'inProgress'
        else if (!isFinished && campaign.hash) type = 'apply'
        else type = 'none'

        return type
    } catch (err) {
        console.error(err)
    }
}
