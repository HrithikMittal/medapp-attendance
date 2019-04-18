const mongoose = require("mongoose")

mongoose.connect("mongodb+srv://attendance-medapp:8MJ9496D5UutComD@cluster0-4dvih.mongodb.net/attendanceApp", {
	useNewUrlParser: true,
	useCreateIndex: true,
	useFindAndModify: false
})

const db = mongoose.connection

module.exports = db
