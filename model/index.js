const User = require('../model/user.model')
const GoogleProfile = require('../model/googleProfile.model')
const FbProfile = require('../model/fbProfile.model')
const LinkedinProfile = require('../model/linkedinProfile.model')
const TikTokProfile = require('../model/tikTokProfile.model')
const Interests = require('../model/interests.model')
const TwitterProfile = require('../model/twitterProfile.model')
const Notification = require('../model/notification.model')
const FbPage = require('../model/fbPage.model')
const Wallet = require('../model/wallet.model')
const CustomToken = require('../model/customToken.model')
const CampaignLink = require('../model/campaignLink.model')
var Campaigns = require('../model/campaigns.model')
var Event = require('../model/event.model')
var Request = require('../model/request.model')
var Captcha = require('../model/captcha.model')
var UserArchived = require('../model/UserArchive.model')
const WalletUserNode = require('../model/walletUserNode.model')
const UserExternalWallet = require('../model/userExternalWallet.model.js');

module.exports = {
    UserArchived,
    Campaigns,
    Captcha,
    Request,
    Event,
    CampaignLink,
    Campaigns,
    User,
    GoogleProfile,
    FbProfile,
    LinkedinProfile,
    TikTokProfile,
    Interests,
    TwitterProfile,
    Notification,
    FbPage,
    Wallet,
    CustomToken,
    WalletUserNode,
    UserExternalWallet
}