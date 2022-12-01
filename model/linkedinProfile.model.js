const mongoose = require('mongoose')

const linkedinProfileSchema = mongoose.Schema(
    {
        accessToken: { type: String },
        userId: { type: Number, required: true, ref: 'user' },
        linkedinId: { type: String, required : true},
        pages: [
            {
                'organization~': {
                    localizedName: { type: String },
                },
                role: { type: String },
                organization: { type: String },
                roleAssignee: { type: String },
                state: { type: String },
                subscribers: { type: Number },
                photo: { type: String },
            },
        ],
        refreshToken: { type: String },
    },

    {
        collection: 'linkedin_profile',
    }
)

const LinkedinProfile = mongoose.model(
    'linkedin_profile',
    linkedinProfileSchema
)
module.exports = LinkedinProfile
