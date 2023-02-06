const mongoose = require('mongoose')

const userArchivedSchema = mongoose.Schema(
    {
        _id: { type: Number },
        first_name: { type: String },
        name: { type: String },
        idSn: { type: Number },
        idOnSn: { type: String },
        idOnSn2: { type: String },
        idOnSn3: { type: String },
        email: { type: String },
        username: { type: String },
        firstName: { type: String },
        lastName: { type: String },
        lastLogin: { type: Date },
        newsLetter: { type: Boolean },
        onBoarding: { type: Boolean },
        account_locked: { type: Boolean },
        failed_count: { type: Number },
        date_locked: { type: Number },
        enabled: { type: Number },
        locale: { type: String },
        userSatt: { type: Boolean },
        picLink: { type: String },
        dateFirstAttempt: { type: Number },
        completed: { type: Boolean },
        password: { type: String },
        secureCode: {
            code: { type: Number },
            expiring: { type: Number },
            type: { type: String },
        },
        hasWallet: { type: Boolean },
        hasWalletV2: { type: Boolean, default: false },
        passphrase: { type: Boolean },
        is2FA: { type: Boolean },
        secret: { type: String },
        photoUpdated: { type: Boolean },
        isChanged: { type: Boolean },
        birthday: { type: String },
        gender: { type: String },
        daily: [
            {
                Date: { type: Number },
                Balance: { type: String },
                convertDate: { type: String },
            },
        ],
        weekly: [
            {
                Date: { type: Number },
                Balance: { type: String },
                convertDate: { type: String },
            },
        ],
        monthly: [
            {
                Date: { type: Number },
                Balance: { type: String },
                convertDate: { type: String },
            },
        ],
        address: { type: String },
        city: { type: String },
        country: { type: String },
        zipCode: { type: String },
        visitPassphrase: { type: Boolean },
        fireBaseAccessToken: { type: String },
        phone: {
            number: { type: String },
            internationalNumber: { type: String },
            nationalNumber: { type: String },
            e164Number: { type: String },
            countryCode: { type: String },
            dialCode: { type: String },
        },
    },
    { timestamps: true, strict: false, collection: 'sn_user_archived' }
)
const UserArchived = mongoose.model('sn_user_archived', userArchivedSchema)
module.exports = UserArchived
