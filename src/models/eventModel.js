const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const eventSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	date: {
		type: Date,
		required: true,
		trim: true
	},
	stime: {
		type: String,
		required: true,
		trim: true
	},
	etime: {
		type: String,
		required: true,
		trim: true
	},
	detail: {
		type: String,
		required: true,
		trim: true
	},
	location: {
		latitude: {
			type: Number,
			required: true,
			trim: true
		},
		longitude: {
			type: Number,
			required: true,
			trim: true
		},
		address: {
			type: String,
			required: true,
			trim: true
		}
	},
	attendances: [{
		type: mongoose.Schema.Types.ObjectId,
		trim: true
	}],
	
}, {
	timestamps: true
})

const Event = mongoose.model("Event", eventSchema)

module.exports = Event