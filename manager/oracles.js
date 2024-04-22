const { linkedinActivityUrl, config, oauth } = require('../conf/config')
var rp = require('axios')
var Web3 = require('web3')
const needle = require('needle')
const {
    web3UrlBep20,
    web3UrlBTT,
    web3Url,
    web3PolygonUrl,
    CampaignConstants,
    OracleConstants,
    web3UrlArthera,
} = require('../conf/const')
const child_process = require('child_process')
const {
    FbPage,
    FbProfile,
    CampaignLink,
    GoogleProfile,
    TwitterProfile,
    Wallet,
    IgMedia,
    LinkedinProfile,
} = require('../model/index')
var fs = require('fs')
const axios = require('axios')
var Twitter = require('twitter')
const { default: Big } = require('big.js')
const {
    getOracleContractByCampaignContract,
    getOracleContractByCampaignContractExternal,
    webTronInstance,
} = require('../blockchainConnexion')
const puppeteer = require('puppeteer')
const { TronConstant } = require('../conf/const')
const { timeout } = require('../helpers/utils')
const { TikTokProfile } = require('../model')
const {
    getWeb3Connection,
    networkProviders,
    networkProvidersOptions,
} = require('../web3/web3-connection')
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
const { responseHandler } = require('../helpers/response-handler')

exports.getLinkedinLinkInfo = async (accessToken, activityURN) => {
    try {
        let linkInfo = {}
        let postData = (
            await rp.get(linkedinActivityUrl(activityURN), {
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
                ].content.contentEntities[0].entityLocaion
        return linkInfo
    } catch (err) {}
}

const extractFollowerCount = (str) => {
    const regex = /(\d+(\.\d+)?)([MK]?)\s*$/

    const match = str.match(regex)

    if (match) {
        let followerCount = parseFloat(match[1])

        if (match[3] === 'K') {
            followerCount *= 1000
        } else if (match[3] === 'M') {
            followerCount *= 1000000
        }

        return parseInt(followerCount, 10)
    }

    return 0
}
exports.verifyFacebook = async (idPost, page) => {
    try {
        if (page) {
            var token = page.token
            var idPage = page.id
            var res = (
                await rp.get(
                    'https://graph.facebook.com/' +
                        process.env.FB_GRAPH_VERSION +
                        '/' +
                        idPage +
                        '_' +
                        idPost +
                        '?access_token=' +
                        token
                )
            ).data
            if (res) return true
        } else {
            return false
        }
    } catch (err) {
        return 'lien_invalid'
    }
}

exports.verifyYoutube = async (userId, idPost, accessToken) => {
    try {
        var res = await rp('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: idPost,
                access_token: accessToken,
                part: 'snippet',
            },
        })

        if (res.data.items) {
            var channelId = res.data.items[0]?.snippet.channelId
            var googleProfile = await GoogleProfile.findOne({
                UserId: userId,
                channelId: channelId,
            }).lean()
            return googleProfile
        } else {
            return false
        }
    } catch (err) {
        console.error('verifyYoutube', err)
    }
}

exports.verifyInsta = async function (userId, idPost) {
    try {
        let userName
        var fbProfile = await FbProfile.findOne(
            { UserId: userId },
            { accessToken: 1 }
        ).lean()
        if (fbProfile) {
            var accessToken = fbProfile.accessToken
            var media =
                'https://graph.facebook.com/' +
                oauth.facebook.fbGraphVersion +
                '/me/accounts?fields=id,instagram_business_account{id, name, username, media{shortcode, username}}&access_token=' +
                accessToken
            var resMedia = (await rp.get(media)).data
            let data = resMedia.data
            data = data.filter(
                (element) => !!element.instagram_business_account
            )
            data.forEach((account) => {
                // userName = account.instagram_business_account.username
                account.instagram_business_account.media.data.forEach(
                    (media) => {
                        if (media.shortcode === idPost) {
                            userName = media.username
                        }
                    }
                )
            })
            if (!userName) {
                return false
            }
            var page = await FbPage.findOne({
                $and: [{ UserId: userId }, { instagram_username: userName }],
            }).lean()

            if (page && !page.deactivate) return true
            else if (page && page.deactivate === true) return 'deactivate'
            else return false
        }
        return false
    } catch (err) {
        return 'lien_invalid'
    }
}

const fetchThreadData = async (res, idPost) => {
    if (!isValidIdPost(idPost)) {
        throw new Error('Invalid idPost')
    }

    const text = res.data.replace(/\s/g, '').replace(/\n/g, '')

    const postID = text.match(/{"post_id":"(.*?)"}/)?.[1]
    const lsdToken = fetchLSDToken(text)

    // THIS FUNCTION WILL GIVE US IF ACCOUNT EXIST OR NO  ( TO LINK SATT ACCOUNT TO THREAD ACCOUNT )
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
    return response
}

exports.verifyThread = async (idPost, threads_id, instagram_username) => {
    try {
        const res = await axios.get(
            `https://www.threads.net/@${instagram_username}/post/${idPost}`
        )
        const response = await fetchThreadData(res, idPost)

        let owner =
            response.data.data.data.containing_thread.thread_items[0].post.user
                .pk
        return threads_id === owner
    } catch (err) {
        return !!postID ? 'lien_invalid' : 'link_not_found'
    }
}
exports.verifyTwitter = async function (twitterProfile, userId, idPost) {
    try {
        const token = process.env.TWITTER_BEARER_TOKEN_V2
        const endpointURL = process.env.TWITTER_API_V2_URL
        const params = {
            ids: idPost, // Edit Tweet IDs to look up
            'tweet.fields': 'lang,author_id', // Edit optional query parameters here
            'user.fields': 'created_at', // Edit optional query parameters here
        }

        // this is the HTTP header that adds bearer token authentication
        const res = await needle('get', endpointURL, params, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        })
        var twitterProfile = await TwitterProfile.findOne({
            id: res.body.data[0].author_id,
            UserId: userId,
        }).select('access_token_key access_token_secret id')
        return twitterProfile ? true : false
    } catch (err) {
        return 'lien_invalid'
    }
}

exports.verifyLinkedin = async (linkedinProfile, idPost) => {
    try {
        let res = false
        let urn = `urn:li:activity:${idPost}`
        let postData = await rp.get(config.linkedinActivityUrl(idPost), {
            headers: {
                Authorization: 'Bearer ' + linkedinProfile.accessToken,
            },
        })

        const {
            data: { results },
        } = postData
        if (!Object.keys(results).length) return res

        let owner =
            results[urn]['domainEntity~'].owner ??
            results[urn]['domainEntity~'].author
        linkedinProfile.pages.forEach((element) => {
            if (element.organization === owner && !element.deactivate)
                res = true
            if (element.organization === owner && element.deactivate === true)
                return 'deactivate'
        })
        return res
    } catch (err) {
        console.error('verifyLinkedin', err)
    }
}

exports.verifytiktok = async function (tiktokProfile, idPost) {
    try {
        let getUrl = `https://open-api.tiktok.com/oauth/refresh_token?client_key=${process.env.TIKTOK_KEY}&grant_type=refresh_token&refresh_token=${tiktokProfile.refreshToken}`
        let resMedia = await rp.get(getUrl)
        let videoInfoResponse = await axios.post(
            'https://open-api.tiktok.com/video/query/',
            {
                access_token: resMedia?.data?.data?.access_token,
                open_id: tiktokProfile.userTiktokId,
                filters: {
                    video_ids: [idPost],
                },
                fields: ['embed_html', 'embed_link'],
            }
        )
        let username =
            videoInfoResponse?.data?.data?.videos?.length &&
            videoInfoResponse.data.data?.videos[0]?.embed_html?.split('/')[3]
        username &&
            (await TikTokProfile.updateOne(
                { _id: tiktokProfile._id },
                { $set: { username } }
            ))

        if (videoInfoResponse.data.data.videos) {
            return true
        } else {
            return false
        }
    } catch (err) {
        return 'lien_invalid'
    }
}

exports.getInstagramUserName = async (shortcode, id) => {
    let userName

    try {
        var fbProfile = await FbProfile.findOne({ UserId: id }).lean()
        if (fbProfile) {
            var accessToken = fbProfile.accessToken
            var media =
                'https://graph.facebook.com/' +
                oauth.facebook.fbGraphVersion +
                '/me/accounts?fields=id,instagram_business_account{id, name, username, media{shortcode, username}}&access_token=' +
                accessToken
            var resMedia = await rp.get(media)
            var data = resMedia.data.data
            data = data.filter(
                (element) => !!element.instagram_business_account
            )
            data.forEach((account) => {
                // userName = account.instagram_business_account.username
                account.instagram_business_account.media.data.forEach(
                    (media) => {
                        if (media.shortcode === shortcode) {
                            userName = media.username
                        }
                    }
                )
            })
        }

        return userName
    } catch (err) {}
}

exports.findBountyOracle = (typeSN) =>
    typeSN == '1'
        ? 'facebook'
        : typeSN == '2'
        ? 'youtube'
        : typeSN == '3'
        ? 'instagram'
        : typeSN == '4'
        ? 'twitter'
        : typeSN == '5'
        ? 'linkedin'
        : typeSN == '6'
        ? 'tiktok'
        : 'threads'

exports.answerAbos = async (
    typeSN,
    idPost,
    idUser,
    linkedinProfile = null,
    tiktokProfile = null,
    id = null,
    userName = false
) => {
    try {
        switch (typeSN) {
            case '1':
                var res = await this.facebookAbos(idUser)

                break
            case '2':
                var res = await this.youtubeAbos(idPost)

                break
            case '3':
                var res = await this.instagramAbos(idPost, id, userName)

                break
            case '4':
                var res = await this.twitterAbos(idUser, idPost)

                break
            case '5':
                var res = await this.linkedinAbos(linkedinProfile, idUser)
                break
            case '6':
                var res = await this.tiktokAbos(tiktokProfile.userId)
                tiktokProfile.followers = res ?? 0
                await tiktokProfile.save()
                break
            case '7':
                var res = await threadsAbos(idPost, userName)
            default:
                var res = 0
                break
        }

        return res
    } catch (error) {}
}

exports.facebookAbos = async (pageName) => {
    try {
        var page = await FbPage.findOne({ username: pageName })

        if (page) {
            var token = page.token
            var res = (
                await rp.get(
                    'https://graph.facebook.com/' +
                        oauth.facebook.fbGraphVersion +
                        '/' +
                        pageName +
                        '?access_token=' +
                        token +
                        '&fields=fan_count'
                )
            ).data

            return res.fan_count
        } else {
            return null
        }
    } catch (err) {}
}

exports.youtubeAbos = async (idPost) => {
    try {
        var res = (
            await rp.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    id: idPost,
                    key: oauth.google.gdataApiKey,
                    part: 'snippet',
                },
            })
        ).data
        if (res.items.length > 0) {
            var channelId = res.items[0]?.snippet.channelId
            var res = (
                await rp.get('https://www.googleapis.com/youtube/v3/channels', {
                    params: {
                        id: channelId,
                        key: oauth.google.gdataApiKey,
                        part: 'statistics',
                    },
                })
            ).data
            let follwers_count = res.items[0].statistics.subscriberCount
            await GoogleProfile.updateMany(
                { channelId },
                { 'channelStatistics.subscriberCount': follwers_count }
            )
            return follwers_count
        } else {
            return null
        }
    } catch (err) {
        console.error('youtubeAbos', err)
    }
}

exports.instagramAbos = async (idPost, id, userName) => {
    try {
        var followers = 0
        var campaign_link = await CampaignLink.findOne({ idPost }).lean()

        let instagramUserName = campaign_link?.instagramUserName || userName
        var fbPage = await FbPage.findOne({
            $and: [
                { UserId: id },
                { instagram_username: instagramUserName },
                { instagram_id: { $exists: true } },
            ],
        })
        if (fbPage) {
            var instagram_id = fbPage.instagram_id
            var fbProfile = await FbProfile.findOne({
                UserId: id,
            })
            var token = fbProfile.accessToken
            var res = await rp.get(
                'https://graph.facebook.com/' +
                    oauth.facebook.fbGraphVersion +
                    '/' +
                    instagram_id +
                    '?access_token=' +
                    token +
                    '&fields=followers_count'
            )
            if (res.data.followers_count)
                return (followers = res.data.followers_count)
            else return null
        }
        return followers
    } catch (err) {}
}

exports.twitterAbos = async function (pageName, idPost) {
    try {
        const token = process.env.TWITTER_BEARER_TOKEN_V2
        const endpointURL = process.env.TWITTER_API_V2_URL
        const params = {
            ids: idPost, // Edit Tweet IDs to look up
            'tweet.fields': 'lang,author_id', // Edit optional query parameters here
            'user.fields': 'created_at', // Edit optional query parameters here
        }

        // this is the HTTP header that adds bearer token authentication
        const res = await needle('get', endpointURL, params, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        })
        const userId = res.body.data[0].author_id
        const userFollowersEndPoint = `https://api.twitter.com/2/users/${userId}?`
        const response = await needle(
            'get',
            userFollowersEndPoint,
            { 'user.fields': 'public_metrics' },
            {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            }
        )
        await TwitterProfile.updateMany(
            {
                id: userId,
            },
            {
                '_json.followers_count':
                    response.body.data.public_metrics.followers_count,
            }
        )
        return response.body.data.public_metrics.followers_count
    } catch (err) {}
}

exports.linkedinAbos = async (linkedinProfile, organization) => {
    try {
        let postData = (
            await rp.get(
                `https://api.linkedin.com/v2/networkSizes/${organization}?edgeType=CompanyFollowedByMember`,
                {
                    headers: {
                        Authorization: 'Bearer ' + linkedinProfile.accessToken,
                    },
                }
            )
        ).data
        var subscribers = postData.firstDegreeSize
        return subscribers
    } catch (err) {
        console.error('linkedinAbos', err)
        return 0
    } finally {
        subscribers &&
            (await LinkedinProfile.updateMany(
                { 'pages.organization': organization },
                { $set: { 'pages.$.subscribers': subscribers } }
            ))
    }
}

exports.tiktokAbos = async (userId, access_token = null) => {
    const accessToken =
        (access_token && access_token) ||
        (
            await TikTokProfile.findOne(
                { userId: +userId },
                { accessToken: 1 }
            ).lean()
        ).accessToken

    try {
        const runCmd = (cmd) => {
            let resp = child_process.execSync(cmd)
            return resp.toString('UTF8')
        }
        var cmd = `curl -L -X GET 'https://open.tiktokapis.com/v2/user/info/?fields=follower_count' \
        -H 'Authorization: Bearer ${accessToken}'`
        var result = JSON.parse(runCmd(cmd))

        return result?.data?.user?.follower_count ?? 0
    } catch (err) {
        console.error('tiktokAbos', err.message ? err.message : err.error)
    }
}

const threadsAbos = async (idPost, userName) => {
    try {
        var campaign_link = await CampaignLink.findOne({ idPost }).lean()
        let instagramUserName = campaign_link?.instagramUserName || userName
        const res = await axios.get(
            `https://www.threads.net/@${instagramUserName}`
        )
        return extractFollowerCount(
            res.data
                .split('Followers')[0]
                .split('content=')
                [
                    user.data.split('Followers')[0].split('content=').length - 1
                ].trim()
        )
    } catch (err) {
        return 0
    }
}

const threads = async (idPost, instagramUserName) => {
    const res = await axios.get(
        `https://www.threads.net/@${instagramUserName}/post/${idPost}`
    )
    const response = await fetchThreadData(res, idPost)

    let media_url
    response.data.data.data.containing_thread.thread_items[0].post?.image_versions2?.candidates.forEach(
        (element) => {
            if (
                element.height == 320 &&
                element.__typename == 'XDTImageCandidate'
            ) {
                media_url = element.url
            }
        }
    )
    const postPicture = await axios.get(media_url, {
        responseType: 'arraybuffer',
    })
    const base64String = Buffer.from(postPicture.data, 'binary').toString(
        'base64'
    )
    return {
        likes: response.data.data.data.containing_thread.thread_items[0].post
            ?.like_count,
        media_url: !!base64String
            ? base64String
            : media_url /*, views :response.data.data.data.containing_thread.thread_items[0].post?.view_count*/,
    }
}
exports.getPromApplyStats = async (
    oracles,
    link,
    id,
    linkedinProfile = null,
    tiktokProfile = null
) => {
    try {
        let socialOracle = {}
        if (oracles === 'facebook')
            socialOracle = await facebook(link.idUser, link.idPost)
        else if (oracles === 'twitter')
            socialOracle = await twitter(link.idUser, link.idPost)
        else if (oracles === 'youtube')
            socialOracle = await youtube(link.idPost)
        else if (oracles === 'instagram')
            socialOracle = await instagram(id, link)
        else if (oracles === 'linkedin') {
            socialOracle = await linkedin(
                link.idUser,
                link.idPost,
                link.typeURL,
                linkedinProfile
            )
        } else if (oracles === 'tiktok') {
            socialOracle = await tiktok(tiktokProfile, link.idPost)
        } else if (oracles === 'threads')
            socialOracle = await threads(link.idPost, link.instagramUserName)

        delete socialOracle?.date
        return socialOracle
    } catch (err) {
        console.error('getPromApplyStats', err)
    }
}

const facebook = async (pageName, idPost) => {
    try {
        var page = await FbPage.findOne({ username: pageName })
        if (page) {
            var token = page.token
            var idPage = page.id
            var res2 = (
                await rp.get(
                    'https://graph.facebook.com/' +
                        oauth.facebook.fbGraphVersion +
                        '/' +
                        idPage +
                        '_' +
                        idPost +
                        '?fields=shares,full_picture&access_token=' +
                        token
                )
            ).data
            var res3 = (
                await rp.get(
                    'https://graph.facebook.com/' +
                        oauth.facebook.fbGraphVersion +
                        '/' +
                        idPage +
                        '_' +
                        idPost +
                        '/insights?metric=post_reactions_by_type_total,post_impressions&period=lifetime&access_token=' +
                        token
                )
            ).data

            var shares = 0
            if (res2.shares) {
                shares = res2.shares.count
            }
            var likes = res3.data[0].values[0].value.like || 0
            var views = res3.data[1].values[0].value || 0
            var perf = {
                shares: shares,
                likes: likes,
                views: views,
                date: Math.floor(Date.now() / 1000),
                media_url: res2?.full_picture || ' ',
            }

            return perf
        } else {
            return { shares: 0, likes: 0, views: 0 }
        }
    } catch (err) {}
}

const youtube = async (idPost) => {
    try {
        if (idPost.indexOf('&') !== -1) {
            idPost = idPost.split('&')[0]
        }
        var perf = { shares: 0, likes: 0, views: 0, media_url: '' }

        var body = (
            await rp.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    id: idPost,
                    key: oauth.google.gdataApiKey,
                    part: 'statistics,snippet',
                },
            })
        ).data
        if (body.items && body.items[0]) {
            perf = {
                shares: 0 /*res.items[0].statistics.commentCount*/,
                likes: body.items[0].statistics.likeCount,
                views: body.items[0].statistics.viewCount,
                date: Math.floor(Date.now() / 1000),
                media_url:
                    body.items[0]?.snippet?.thumbnails?.default?.url || ' ',
            }
        }

        return perf
    } catch (err) {}
}
const linkedin = async (organization, idPost, type, linkedinProfile) => {
    try {
        let accessToken = linkedinProfile.accessToken
        var perf = { shares: 0, likes: 0, views: 0 }
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
            let resAccessToken = (await rp.get(accessTokenUrl)).data
            accessToken = resAccessToken.access_token
        }

        let url = config.linkedinStatsUrl(type, idPost, organization)

        var body = (
            await rp.get(url, {
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                },
            })
        ).data
        if (body.elements.length) {
            perf.views = body.elements[0]?.totalShareStatistics.impressionCount
            perf.likes = body.elements[0]?.totalShareStatistics.likeCount
            perf.shares = body.elements[0]?.totalShareStatistics.shareCount
        }
        // if (type !== 'share') {
        //     const linkedinVideoData = {
        //         url: config.linkedinUgcPostStats(idPost),
        //         method: 'GET',
        //         headers: {
        //             Authorization: 'Bearer ' + accessToken,
        //         },
        //         json: true,
        //     }
        //     var bodyVideo = await rp(linkedinVideoData)
        //     perf.views = bodyVideo.elements[0].value
        // }
        return perf
    } catch (err) {
        console.log('error', err)
    }
}

const getNewAccessTokenInstagram = async (accessToken, fbGraphVersion) => {
    var mediaGetNewAccessToken = `https://graph.facebook.com/${fbGraphVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.APPID}&client_secret=${process.env.APP_SECRET}&fb_exchange_token=${accessToken}`
    var resMediaAccessToken = await rp.get(mediaGetNewAccessToken)
    return resMediaAccessToken.data.access_token
}

const instagram = async (UserId, link) => {
    try {
        const idPost = link.idPost
        const postPerformanceData = {
            shares: 0,
            likes: 0,
            views: 0,
            media_url: '',
        }
        const instagramUserName = link.instagramUserName
        const fbPage = await FbPage.findOne({
            instagram_username: instagramUserName,
        })
        if (fbPage && fbPage.instagram_id) {
            const instagramId = fbPage.instagram_id
            const fbProfile = await FbProfile.findOne({ UserId: UserId }).lean()
            if (fbProfile) {
                const accessToken = await getNewAccessTokenInstagram(
                    fbProfile.accessToken,
                    oauth.facebook.fbGraphVersion
                )
                const media = `https://graph.facebook.com/${oauth.facebook.fbGraphVersion}/${instagramId}/media?fields=like_count,shortcode,media_url&limit=50&access_token=${accessToken}`
                const resMedia = await rp.get(media)
                const data = resMedia.data.data
                for (let i = 0; i < data.length; i++) {
                    if (data[i].shortcode == idPost) {
                        postPerformanceData.likes = data[i].like_count
                        postPerformanceData.media_url =
                            data[i]?.media_url || ' '
                        // CHECK IF REEL
                        const mediaType = `https://graph.facebook.com/${oauth.facebook.fbGraphVersion}/${data[i].id}?fields=media_type,media_product_type&access_token=${accessToken}`
                        const mediaViews = `https://graph.facebook.com/${oauth.facebook.fbGraphVersion}/${data[i].id}/insights?metric=impressions,reach&access_token=${accessToken}`
                        const mediaViewReels = `https://graph.facebook.com/${oauth.facebook.fbGraphVersion}/${data[i].id}/insights?metric=plays&access_token=${accessToken}`
                        try {
                            // GET TYPE OF POST
                            const resMediaType = await rp.get(mediaType)
                            const resMediaViews = await rp.get(
                                !!resMediaType.data &&
                                    resMediaType.data.media_type === 'VIDEO' &&
                                    resMediaType.data.media_product_type ===
                                        'REELS'
                                    ? mediaViewReels
                                    : mediaViews
                            )
                            postPerformanceData.views =
                                resMediaViews.data.data[0].values[0].value || 0
                        } catch (error) {
                            postPerformanceData.views = 0
                            console.error(
                                'Error when fetching Instagram data',
                                error
                            )
                            return postPerformanceData
                        }
                        break
                    }
                }
                return postPerformanceData
            } else {
                return 'indisponible'
            }
        }
    } catch (err) {
        console.error('instagram manager oracle', err)
    }
}

const twitter = async (userName, idPost) => {
    try {
        const token = process.env.TWITTER_BEARER_TOKEN_V2
        const endpointURL = process.env.TWITTER_API_V2_URL
        const params = {
            ids: idPost, // Edit Tweet IDs to look up
            'tweet.fields': 'public_metrics', // Edit optional query parameters here
            'media.fields':
                'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text', // Edit optional query parameters here
            expansions: 'attachments.media_keys',
        }
        // this is the HTTP header that adds bearer token authentication
        const res = await needle('get', endpointURL, params, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        })

        var perf = {
            shares: res.body.data[0].public_metrics.retweet_count,
            likes: res.body.data[0].public_metrics.like_count,
            views: res.body.data[0].public_metrics.impression_count,
            date: Math.floor(Date.now() / 1000),
            media_url: !!res.body?.includes?.media?.[0]?.url
                ? res.body.includes.media[0].url
                : ' ',
        }
        return perf
    } catch (err) {
        console.error('error twittRate limit exceededer oracles', err)
        return err[0]?.message === 'Rate limit exceeded'
            ? 'Rate limit exceeded'
            : err[0]?.message === 'No status found with that ID.'
            ? 'No found'
            : 'indisponible'
    }
}

const tiktok = async (tiktokProfile, idPost) => {
    if (!tiktokProfile) {
        return 'indisponible'
    }

    try {
        const url = 'https://open.tiktokapis.com/v2/oauth/token/'
        const data = new URLSearchParams()
        data.append('client_key', process.env.TIKTOK_KEY)
        data.append('client_secret', process.env.TIKTOK_SECRET)
        data.append('grant_type', 'refresh_token')
        data.append('refresh_token', tiktokProfile.refreshToken)

        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
        }

        const resMedia = await axios.post(url, data, config)
        const accessToken = resMedia?.data?.access_token

        if (accessToken)
            await TikTokProfile.updateOne(
                { _id: tiktokProfile._id },
                { accessToken }
            )

        const queryData = {
            filters: {
                video_ids: [idPost],
            },
        }

        const videoInfoResponse = await axios.post(
            'https://open.tiktokapis.com/v2/video/query/?fields=id,title,view_count,share_count,like_count,cover_image_url',
            queryData,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        const videoData = videoInfoResponse.data.data?.videos?.[0] || {}
        return {
            likes: videoData.like_count || 0,
            shares: videoData.share_count || 0,
            views: videoData.view_count || 0,
            media_url: videoData.cover_image_url || ' ',
        }
    } catch (error) {
        console.error('tiktok fetch stats', error)
    }
}

exports.getReachLimit = (campaignRatio, oracle) => {
    try {
        let ratio = campaignRatio.find((item) => item.oracle == oracle)
        if (ratio) return ratio.reachLimit
    } catch (error) {}
}

exports.getTotalToEarn = (socialStats, ratio) => {
    try {
        let reachLimit = this.getReachLimit(ratio, socialStats.oracle)
        if (reachLimit)
            socialStats = this.limitStats(
                '',
                socialStats,
                '',
                socialStats.abosNumber,
                reachLimit
            )
        let totalToEarn = '0'
        let payedAmount = socialStats.payedAmount || '0'
        ratio?.forEach((num) => {
            if (
                num.oracle === socialStats.oracle ||
                num.typeSN === socialStats.typeSN
            ) {
                let view = socialStats.views
                    ? new Big(num['view']).times(socialStats.views)
                    : '0'
                let like = socialStats.likes
                    ? new Big(num['like'] || '0').times(
                          socialStats.likes || '0'
                      )
                    : '0'
                let share = socialStats.shares
                    ? new Big(num['share']).times(socialStats.shares.toString())
                    : '0'
                let total = new Big(view)
                    .plus(new Big(like))
                    .plus(new Big(share))
                    .toFixed()
                totalToEarn = new Big(total).gt(new Big(payedAmount))
                    ? total
                    : payedAmount
            }
        })
        return totalToEarn
    } catch (err) {
        console.error(err)
    }
}

exports.getReward = (result, bounties) => {
    try {
        let payedAmount = result.payedAmount || '0'
        let totalToEarn = '0'

        bounties.forEach((bounty) => {
            if (
                bounty.oracle === result.oracle ||
                bounty.oracle == this.findBountyOracle(result.typeSN)
            ) {
                // bounty = bounty.toObject()
                bounty.categories.forEach((category) => {
                    if (
                        +category.minFollowers <= +result.abosNumber &&
                        +result.abosNumber <= +category.maxFollowers
                    ) {
                        let total = category.reward
                        totalToEarn = new Big(total).gt(new Big(payedAmount))
                            ? total
                            : payedAmount
                    } else if (+result.abosNumber > +category.maxFollowers) {
                        let total = category.reward
                        totalToEarn = new Big(total).gt(new Big(payedAmount))
                            ? total
                            : payedAmount
                    }
                })
            }
        })
        return totalToEarn
    } catch (err) {
        console.error(err)
    }
}

exports.getButtonStatus = (link) => {
    try {
        var totalToEarn = '0'
        link.payedAmount = link.payedAmount || '0'

        if (link.status === false) {
            return 'waiting_for_validation'
        }

        if (link.totalToEarn) totalToEarn = link.totalToEarn

        if (link.reward)
            totalToEarn =
                link.isPayed === false ? link.reward : link.payedAmount

        if (
            link.isPayed === true ||
            (link.payedAmount !== '0' &&
                new Big(totalToEarn).lte(new Big(link.payedAmount)))
        )
            return 'already_recovered'

        if (totalToEarn === '0' && link.payedAmount === '0') return 'no_gains'

        if (
            totalToEarn === '0' &&
            link.campaign.funds[1] === '0' &&
            link.payedAmount === '0'
        )
            return 'not_enough_budget'

        if (
            (new Big(totalToEarn).gt(new Big(link.payedAmount)) &&
                link.status === true &&
                link.campaign?.ratios?.length) ||
            (link.isPayed === false &&
                new Big(totalToEarn).gt(new Big(link.payedAmount)) &&
                link.status === true &&
                link.campaign.bounties?.length)
        ) {
            // link.status = true
            return 'harvest'
        }

        if (link.status === 'indisponible') return 'indisponible'

        if (link.status === 'rejected') return 'rejected'

        return 'none'
    } catch (err) {
        console.error(err)
    }
}

exports.answerBounty = async function (opts) {
    try {
        if (!!opts.tronWeb) {
            let tronWeb = await webTronInstance()
            var tronCampaignKeystore = fs.readFileSync(
                process.env.CAMPAIGN_TRON_WALLET_PATH,
                'utf8'
            )
            tronCampaignWallet = JSON.parse(tronCampaignKeystore)

            let ethAddr = tronCampaignWallet.address.slice(2)
            tronCampaignWallet.address = ethAddr

            let wallet = opts.credentials.Web3ETH.eth.accounts.decrypt(
                tronCampaignWallet,
                process.env.CAMPAIGN_TRON_OWNER_PASS
            )
            tronWeb.setPrivateKey(wallet.privateKey.slice(2))
            let walletAddr = tronWeb.address.fromPrivateKey(
                wallet.privateKey.slice(2)
            )
            tronWeb.setAddress(walletAddr)

            let contract = await tronWeb.contract(
                TronConstant.oracle.abi,
                TronConstant.oracle.address
            )
            let receipt = await contract
                .answerBounty(opts.campaignContract, opts.idProm, opts.nbAbos)
                .send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false,
                })
            await timeout(10000)
            let result = await tronWeb.trx.getTransaction(receipt)
            if (result.ret[0].contractRet === 'SUCCESS') {
                return { result: 'OK', hash: receipt }
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }
        let contract = await getOracleContractByCampaignContract(
            opts.credentials
        )
        var campaignKeystore = fs.readFileSync(
            process.env.CAMPAIGN_WALLET_PATH,
            'utf8'
        )

        campaignWallet = JSON.parse(campaignKeystore)

        !!opts.credentials.Web3ARTHERA
            ? opts.credentials.Web3ARTHERA.eth.accounts.wallet.decrypt(
                  [campaignWallet],
                  process.env.CAMPAIGN_OWNER_PASS
              )
            : opts.credentials.WEB3.eth.accounts.wallet.decrypt(
                  [campaignWallet],
                  process.env.CAMPAIGN_OWNER_PASS
              )

        var gasPrice = !!opts.credentials.Web3ARTHERA
            ? await opts.credentials.Web3ARTHERA.eth.getGasPrice()
            : await contract.getGasPrice()

        var receipt = await contract.methods
            .answerBounty(opts.campaignContract, opts.idProm, opts.nbAbos)
            .send({
                from: process.env.CAMPAIGN_OWNER,
                gas: 500000,
                gasPrice: gasPrice,
            })
            .once('transactionHash', function (hash) {})
        return { result: 'OK', hash: receipt.hash }
    } catch (err) {}
}

exports.answerOne = async (
    typeSN,
    idPost,
    idUser,
    type = null,
    linkedinProfile = null,
    tiktokProfile = null,
    instagramUserName,
    external
) => {
    try {
        switch (typeSN) {
            case '1':
                var res = await facebook(idUser, idPost)

                break
            case '2':
                var res = await youtube(idPost)

                break
            case '3':
                var campaign_link = await CampaignLink.findOne({ idPost })
                if (!external) {
                    var userWallet = await Wallet.findOne(
                        {
                            $or: [
                                {
                                    'keystore.address': campaign_link.id_wallet
                                        .toLowerCase()
                                        .substring(2),
                                },
                                {
                                    'walletV2.keystore.address':
                                        campaign_link.id_wallet
                                            .toLowerCase()
                                            .substring(2),
                                },
                            ],
                        },
                        { UserId: 1 }
                    ).lean()
                }
                var res = await instagram(
                    external ? idUser : userWallet.UserId,
                    campaign_link
                )
                break
            case '4':
                var res = await twitter(idUser, idPost)

                break
            case '5':
                var res = await linkedin(idUser, idPost, type, linkedinProfile)

                break
            case '6':
                var res = await tiktok(tiktokProfile, idPost)

                break
            case '7':
                var res = await threads(idPost, instagramUserName)
                break
            default:
                var res = { likes: 0, shares: 0, views: 0, date: Date.now() }
                break
        }

        return res
    } catch (error) {}
}

exports.limitStats = (typeSN, stats, ratios, abos, limit = '') => {
    try {
        let calculstats = { ...stats }
        if (!limit) {
            var limits = ratios[4]
            limit = limits[parseInt(typeSN) - 1]
        }
        if (limit > 0) {
            limit = parseFloat(limit)
            var max = Math.ceil((limit * parseFloat(abos)) / 100)
            if (+stats?.views > max) {
                calculstats.views = max
            }
            if (+stats?.likes > max) {
                calculstats.likes = max
            }
            if (+stats?.shares > max) {
                calculstats.shares = max
            }
        }

        return calculstats
    } catch (error) {
        console.error(error)
    }
}

exports.answerCall = async (opts) => {
    try {
        if (!!opts.tronWeb) {
            var tronCampaignKeystore = fs.readFileSync(
                process.env.CAMPAIGN_TRON_WALLET_PATH,
                'utf8'
            )
            tronCampaignWallet = JSON.parse(tronCampaignKeystore)

            let ethAddr = tronCampaignWallet.address.slice(2)
            tronCampaignWallet.address = ethAddr

            let webTron = getWeb3Connection(
                networkProviders['ERC20'],
                networkProvidersOptions['ERC20']
            )

            let wallet = webTron.eth.accounts.decrypt(
                tronCampaignWallet,
                process.env.CAMPAIGN_TRON_OWNER_PASS
            )

            let tronWeb = await webTronInstance()
            tronWeb.setPrivateKey(wallet.privateKey.slice(2))
            let walletAddr = tronWeb.address.fromPrivateKey(
                wallet.privateKey.slice(2)
            )
            tronWeb.setAddress(walletAddr)
            let contract = await tronWeb.contract(
                TronConstant.oracle.abi,
                TronConstant.oracle.address
            )
            let receipt = await contract
                .answer(
                    opts.campaignContract,
                    opts.idRequest,
                    opts.likes,
                    opts.shares,
                    opts?.views
                )
                .send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false,
                })
            await timeout(10000)
            let result = await tronWeb.trx.getTransaction(receipt)
            if (result.ret[0].contractRet === 'SUCCESS') {
                return { result: 'OK', hash: receipt } //TODO check if transaction if went with SUCCESS
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }
        let contract = await getOracleContractByCampaignContract(
            opts.credentials
        )
        var campaignKeystore = fs.readFileSync(
            process.env.CAMPAIGN_WALLET_PATH,
            'utf8'
        )

        campaignWallet = JSON.parse(campaignKeystore)

        !!opts.credentials.Web3ARTHERA
            ? opts.credentials.Web3ARTHERA.eth.accounts.wallet.decrypt(
                  [campaignWallet],
                  process.env.CAMPAIGN_OWNER_PASS
              )
            : opts.credentials.WEB3.eth.accounts.wallet.decrypt(
                  [campaignWallet],
                  process.env.CAMPAIGN_OWNER_PASS
              )

        var gasPrice = !!opts.credentials.Web3ARTHERA
            ? await opts.credentials.Web3ARTHERA.eth.getGasPrice()
            : await contract.getGasPrice()
        var receipt = await contract.methods
            .answer(
                opts.campaignContract,
                opts.idRequest,
                opts.likes,
                opts.shares,
                opts.views
            )
            .send({
                from: process.env.CAMPAIGN_OWNER,
                gas: 500000,
                gasPrice: gasPrice,
            })
            .once('transactionHash', function (hash) {})
        return { result: 'OK', hash: receipt.hash }
    } catch (error) {
        console.error('answerCall', error)
    }
}

exports.answerCallExternal = async (opts) => {
    try {
        if (!!opts.tronWeb) {
            var tronCampaignKeystore = fs.readFileSync(
                process.env.CAMPAIGN_TRON_WALLET_PATH,
                'utf8'
            )
            tronCampaignWallet = JSON.parse(tronCampaignKeystore)

            let ethAddr = tronCampaignWallet.address.slice(2)
            tronCampaignWallet.address = ethAddr

            let webTron = getWeb3Connection(
                networkProviders['ERC20'],
                networkProvidersOptions['ERC20']
            )

            let wallet = webTron.eth.accounts.decrypt(
                tronCampaignWallet,
                process.env.CAMPAIGN_TRON_OWNER_PASS
            )

            let tronWeb = await webTronInstance()
            tronWeb.setPrivateKey(wallet.privateKey.slice(2))
            let walletAddr = tronWeb.address.fromPrivateKey(
                wallet.privateKey.slice(2)
            )
            tronWeb.setAddress(walletAddr)
            let contract = await tronWeb.contract(
                TronConstant.oracle.abi,
                TronConstant.oracle.address
            )
            let receipt = await contract
                .answer(
                    opts.campaignContract,
                    opts.idRequest,
                    opts.likes,
                    opts.shares,
                    opts?.views
                )
                .send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false,
                })
            await timeout(10000)
            let result = await tronWeb.trx.getTransaction(receipt)
            if (result.ret[0].contractRet === 'SUCCESS') {
                return { result: 'OK', hash: receipt } //TODO check if transaction if went with SUCCESS
            } else {
                res.status(500).send({
                    code: 500,
                    error: result,
                })
            }
        }
        // let contract = await getOracleContractByCampaignContractExternal(
        //     opts.credentials
        // )
        var campaignKeystore = fs.readFileSync(
            process.env.CAMPAIGN_WALLET_PATH,
            'utf8'
        )

        campaignWallet = JSON.parse(campaignKeystore)

        const web3 = new Web3(
            new Web3.providers.HttpProvider(
                opts.credentials.network.toUpperCase() === 'ARTHERA'
                    ? web3UrlArthera
                    : web3UrlBep20,
                options
            )
        )

        // Decrypt the campaign wallet using the owner's password
        const decryptedAccounts = web3.eth.accounts.wallet.decrypt(
            [campaignWallet],
            process.env.CAMPAIGN_OWNER_PASS
        )

        if (!decryptedAccounts || decryptedAccounts.length === 0) {
            throw new Error('Failed to decrypt the campaign wallet.')
        }
        // var contract = new web3.eth.Contract(
        //     OracleConstants[credentials.network.toUpperCase()].abi,
        //     OracleConstants[credentials.network.toUpperCase()].address
        // )
        const contract = new web3.eth.Contract(
            OracleConstants[opts.credentials.network.toUpperCase()].abi,
            OracleConstants[opts.credentials.network.toUpperCase()].address
        )

        // Set the gas price
        const gasPrice = await web3.eth.getGasPrice()

        // var gasPrice = await contract.getGasPrice()
        var receipt = await contract.methods
            .answer(
                opts.campaignContract,
                opts.idRequest,
                opts.likes,
                opts.shares,
                opts.views
            )
            .send({
                from: process.env.CAMPAIGN_OWNER,
                gas: 800000,
                gasPrice: gasPrice,
            })
            .once('transactionHash', function (hash) {})
        return { result: 'OK', hash: receipt.hash }
    } catch (error) {
        console.error('answerCall', error)
    }
}
exports.updateFacebookPages = async (UserId, accessToken, isInsta = false) => {
    try {
        var instagram_id = false
        var accountsUrl =
            'https://graph.facebook.com/' +
            process.env.FB_GRAPH_VERSION +
            '/me/accounts?fields=instagram_business_account,access_token,username,name,picture,fan_count&access_token=' +
            accessToken
        var res = (await rp.get(accountsUrl)).data

        if (res.data.length === 0) {
            return
        } else {
            while (true) {
                for (var i = 0; i < res.data.length; i++) {
                    let page = {
                        UserId: UserId,
                        username: res.data[i].username,
                        token: res.data[i].access_token,
                        picture: res.data[i].picture.data.url,
                        name: res.data[i].name,
                        subscribers: res.data[i].fan_count,
                    }

                    if (res.data[i].instagram_business_account) {
                        if (!isInsta) {
                            isInsta = true
                        }
                        instagram_id = res.data[i].instagram_business_account.id
                        page.instagram_id = instagram_id
                        var media =
                            'https://graph.facebook.com/' +
                            process.env.FB_GRAPH_VERSION +
                            '/' +
                            instagram_id +
                            '?fields=username&access_token=' +
                            accessToken
                        var resMedia = (await rp.get(media)).data
                        page.instagram_username = resMedia.username
                    }
                    await FbPage.updateOne(
                        { id: res.data[i].id, UserId },
                        { $set: page },
                        { upsert: true }
                    )
                }
                if (!res.paging || !res.paging.next) {
                    break
                }
                res = (await rp.get(res.paging.next)).data
            }
        }
    } catch (e) {}
}
exports.getFacebookUsername = async (userId, idlink) => {
    try {
        const fbpage = await FbPage.findOne({ UserId: userId })
        const accessToken = fbpage.token
        const response = await fetch(
            `https://graph.facebook.com/${idlink}?access_token=${accessToken}`
        )
        const json = await response.json()
        const fbpagename = json.name
        var fbprofile = await FbPage.findOne({ name: fbpagename })
        return fbprofile.username
    } catch (err) {}
}

exports.getFacebookPages = async (UserId, accessToken, isInsta = false) => {
    try {
        let message = 'account_linked_with_success'
        var instagram_id = false
        var accountsUrl =
            'https://graph.facebook.com/' +
            process.env.FB_GRAPH_VERSION +
            '/me/accounts?fields=instagram_business_account,access_token,username,name,picture,fan_count&access_token=' +
            accessToken
        var res = (await rp.get(accountsUrl)).data

        let pages = await FbPage.find({ UserId })
        if (res.data.length === 0) {
            message = 'required_page'
        } else if (this.isDefferent(res.data, pages)) {
            while (true) {
                for (var i = 0; i < res.data.length; i++) {
                    let page = {
                        UserId: UserId,
                        username: res.data[i].username,
                        token: res.data[i].access_token,
                        picture: res.data[i].picture.data.url,
                        name: res.data[i].name,
                        subscribers: res.data[i].fan_count,
                    }

                    if (res.data[i].instagram_business_account) {
                        if (!isInsta) {
                            message += '_instagram_facebook'
                            isInsta = true
                        }
                        instagram_id = res.data[i].instagram_business_account.id
                        page.instagram_id = instagram_id
                        var media =
                            'https://graph.facebook.com/' +
                            process.env.FB_GRAPH_VERSION +
                            '/' +
                            instagram_id +
                            '?fields=username&access_token=' +
                            accessToken
                        var resMedia = (await rp.get(media)).data
                        page.instagram_username = resMedia.username
                    }
                    await FbPage.updateOne(
                        { id: res.data[i].id, UserId },
                        { $set: page },
                        { upsert: true }
                    )
                }
                if (!res.paging || !res.paging.next) {
                    break
                }
                res = (await rp.get(res.paging.next)).data
            }

            if (!isInsta && res.data.length > 0) message += '_facebook'
        } else {
            message = 'page already exists'
        }
        return message
    } catch (e) {}
}
exports.isDefferent = (data, pages) => {
    try {
        let isNew = false
        let i = 0
        while (!isNew && i < data.length) {
            let items = data[i]
            let object = pages.find((item) => item.id == items.id) || false
            if (!object) {
                isNew = true
                return true
            } else i++
        }
        return isNew
    } catch (e) {
        return { message: e.message }
    }
}

// Validate the idPost parameter
function isValidIdPost(idPost) {
    // Add your validation logic here
    // For example, check if it's a non-empty string, or if it matches a specific format
    return typeof idPost === 'string' && idPost.trim().length > 0
}

const fetchLSDToken = (text) =>
    text.match(/"LSD",\[\],{"token":"(\w+)"},\d+\]/)?.[1]
