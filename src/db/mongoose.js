const mongoose = require("mongoose")

mongoose.connect("mongodb+srv://admin-deepak:hNJmGwp24M4Y6LI6@cluster0-hh7uz.mongodb.net/attendanceApp?retryWrites=true", {
	useNewUrlParser: true,
	useCreateIndex: true,
	useFindAndModify: false
})

const db = mongoose.connection

module.exports = db