const express = require("express")
const mongoose = require("mongoose")
const moment = require("moment")
const Admin = require("../models/adminModel")
const Employee = require("../models/employeeModel")
const Event = require("../models/eventModel")
const { isAdminLoggedIn, isAdminLoggedOut } = require("../middleware/auth.js")
const { check, validationResult } = require("express-validator/check");

const router = express.Router()

const title = {
	adminLogin: "Login | Admin",
	adminDashboard: "Dashboard | Admin",
	adminAddEvent: "Add Event | Admin",
	adminViewAttendance: "View attendance | Admin"
}

router.get("/login", isAdminLoggedOut, (req, res) => {
	res.render("./admin/login", {
		pageTitle: title.adminLogin,
		email: ""
	})
})

router.post("/login", isAdminLoggedOut, [
		check("email").not().isEmpty().withMessage("Please provide Admin ID.").trim().escape(),
		check("password").not().isEmpty().withMessage("Please provide password.").trim().escape()
	], async (req, res) => {
		try {
			let email = req.body.email
			let password = req.body.password

			const errors = validationResult(req)

			if(!errors.isEmpty()){
				return res.render("./admin/login", {
					pageTitle: title.adminLogin,
					errors: errors.array(),
					email
				})
			}
			const admin = await Admin.authenticate(email, password)
			
			if(!admin){
				req.flash("danger", "Incorrect email or password!")
				return res.render("./admin/login", {
					pageTitle: title.adminLogin,
					email
				})
			}

			req.session.admin = admin

			res.redirect("/medapp-attendance-admin/dashboard")
		} catch(e) {
			res.status(400).send("Unable to login!\n" + e)
		}
})


router.get("/logout", isAdminLoggedIn, (req, res) => {
	req.session.admin = null
	res.redirect("/medapp-attendance-admin/login")
})

router.get("/dashboard", isAdminLoggedIn, async (req, res) => {
	try {
		let monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
		let yearArray = []

		for(let y = moment().year(); y >= 2000; y--)
			yearArray.push(String(y))

		if(["month", "year"].includes(req.query.option)) {

			let viewBy = req.query.option
			let month = Number(req.query.month)
			let year = req.query.year
			let expression = {}

			if(viewBy === "month" && ( month >= 1 && month <= 12) && yearArray.includes(year)) {
				expression = {
					$and: [
						{$eq: [{$year: "$date"}, Number(year)]},
						{$eq: [{$month: "$date"}, month]}
					]
				}
			} else if(viewBy === "year" && yearArray.includes(year)) {
				expression = {
					$eq: [{$year: "$date"}, Number(year)]
				}
			} else {
				req.flash("danger", "Invalid Operation!")
				return res.redirect("/medapp-attendance-admin/dashboard")
			}

			const events = await Event.find({ 
				$expr: expression
			}).sort({ date: 1})
			
			res.render("./admin/dashboard", {
				pageTitle: title.adminDashboard,
				viewBy,
				month,
				monthName: monthArray[month - 1],
				year,
				monthArray,
				yearArray,
				events
			})			
		} else {
			let month = moment().month() + 1
			let year = moment().year()
			let viewBy = "month"
			let events = await Event.find({
				$expr: {
					$and: [
						{$eq: [{$year: "$date"}, year]},
						{$eq: [{$month: "$date"}, month]}
					]
				}
			}).sort({ createdAt: 1})

			res.render("./admin/dashboard", {
				pageTitle: title.adminDashboard,
				viewBy,
				month,
				monthName: monthArray[month - 1],
				year,
				monthArray,
				yearArray,
				events
			})
		}
	} catch(e) {
		res.status(400).send(`<h3>Something went wrong!</h3><p>${e}</p>`)
	}
})

router.get("/events", isAdminLoggedIn, async (req, res) => {
	try {
		if(req.query.eid) {

			const isDeleted = await Event.deleteOne({ _id: req.query.eid })

			if(isDeleted.n > 0) {
				req.flash("warning", "Event Deleted!")
			} else {
				req.flash("danger", "Invalid Operation!")
			}

			res.redirect("/medapp-attendance-admin/dashboard")

		} else {
			res.render("./admin/addEvent", {
				pageTitle: title.adminAddEvent,
				name: "",
				date: "",
				detail: ""
			})
		}
	} catch(e) {
		res.status(400).send(`<h3>Something went wrong!</h3><p>${e}</p>`)
	}
})

router.post("/events", isAdminLoggedIn, [
		check("name").not().isEmpty().withMessage("Please provide event name!").trim().escape(),
		check("date").not().isEmpty().withMessage("Please select event date!").trim().escape(),
		check("stime").not().isEmpty().withMessage("Please provide starting time!").custom((value) => value.match(/^\d{2}:\d{2}?$/)).withMessage("Invalid format for starting time!").trim().escape(),
		check("etime").not().isEmpty().withMessage("Please provide ending time!").custom((value) => value.match(/^\d{2}:\d{2}?$/)).withMessage("Invalid format for starting time!").trim().escape(),
		check("detail").not().isEmpty().withMessage("Please provide event detail!").trim().escape(),
		check("latitude").not().isEmpty().withMessage("Please select a location!").trim().escape(),
		check("longitude").not().isEmpty().withMessage("Please select a location!").trim().escape(),
		check("address").not().isEmpty().withMessage("Please select a location!").trim().escape()
	], async(req, res) => {
	try {
		const name = req.body.name
		const date = req.body.date
		const detail = req.body.detail

		const errors = validationResult(req)

		if(!errors.isEmpty()){
			return res.render("./admin/addEvent", {
				pageTitle: title.adminAddEvent,
				errors: errors.array(),
				name,
				date,
				detail
			})
		}

		const longitude = req.body.longitude
		const latitude = req.body.latitude
		const address = req.body.address
		const stime = req.body.stime
		const etime = req.body.etime

		const event = new Event({
			name,
			date,
			stime,
			etime,
			detail,
			location: {
				latitude,
				longitude,
				address
			}
		})

		await event.save()

		req.flash("Event created successfully!")
		res.redirect("/medapp-attendance-admin/dashboard")

	} catch(e) {
		res.status(400).send(`<h3>Something went wrong!</h3><p>${e}</p>`)
	}	
})

router.get("/viewAttendance", isAdminLoggedIn, async (req, res) => {
	try {
		if(req.query.eid) {
			const event = await Event.findById(req.query.eid)

			await event.populate("attendances.employee").execPopulate()

			res.render("./admin/viewAttendance", {
				pageTitle: title.adminViewAttendance,
				event
			})

		}else {
			req.flash("danger", "Invalid Request")
			res.redirect("/dashboard")
		}
	} catch(e) {
		res.status(400).send(`<h3>Something went wrong!</h3><p>${e}</p>`)
	}
})

router.get("/employee", isAdminLoggedIn, async (req, res) => {
	try {

		if(req.query.emp) {
			const employee = await Employee.findById(req.query.emp)
			res.render("./admin/viewEmployee", {
				pageTitle: title.adminViewEmployee,
				employee,
				employees: ""
			})
		}else {
			const employees = await Employee.find({})
			res.render("./admin/viewEmployee", {
				pageTitle: title.adminViewEmployee,
				employees,
				employee: ""
			})
		}

	} catch(e) {
		res.status(400).send(`<h3>Something went wrong!</h3><p>${e}</p>`)
	}
})

router.get("/employee/avatar", isAdminLoggedIn, async (req, res) => {
	try {
		const employee = await Employee.findOne({ _id: req.query.emp}, "avatar")
		res.set("Content-Type", "image/png")
		res.send(employee.avatar)
	} catch(e) {
		res.sendStatus(500)
	}
})

module.exports = router