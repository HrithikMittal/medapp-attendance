const sharp = require("sharp")
const multer = require("multer")
const moment = require("moment")
const express = require("express")
const geolib = require("geolib")
const validator = require("validator")
const Employee = require("../models/employeeModel")
const Event = require("../models/eventModel")
const mongoose = require("mongoose")
const { isEmployeeLoggedIn, isEmployeeLoggedOut } = require("../middleware/auth.js")
const { check, validationResult } = require("express-validator/check");

const uploadAvatar = multer({
	fileFilter (req, file, cb) {
		if(!file.originalname.match(/\.(jpg|jpeg|png)$/)){
			return cb(undefined, false)
		}

		cb(undefined, true)
	}
})

const router = new express.Router()

const title = {
	employeeLogin: "Login | Employee",
	employeeRegister: "Register | Employee",
	employeeDashboard: "Dashboard | Employee",
	employeeProfile: "Profile | Employee"
}

router.get("/login", isEmployeeLoggedOut, (req, res) => {
	res.render("./employee/login", {
		pageTitle: title.employeeLogin,
		email: ""
	})
})

router.get("/register", isEmployeeLoggedOut, (req, res) => {
	res.render("./employee/register", {
		pageTitle: title.employeeRegister,
		name: "",
		email: ""
	})
})

router.post("/login", isEmployeeLoggedOut, [
		check("email").not().isEmpty().withMessage("Please provide employee Id.").trim().escape(),
		check("password").not().isEmpty().withMessage("Please provide password.").trim().escape()
	], async (req, res) => {
		try {
			let email = req.body.email
			let password = req.body.password

			const errors = validationResult(req)

			if(!errors.isEmpty()){
				return res.render("./employee/login", {
					pageTitle: title.employeeLogin,
					errors: errors.array(),
					email
				})
			}

			if(!(validator.isEmail(email) || validator.isAlphanumeric(email))) {
				req.flash("danger", "Provide an email or ID")
				return res.redirect("/employee/login")
			}

			const employee = await Employee.authenticate(email, password)
			
			if(!employee){
				req.flash("danger", "Incorrect email or password!")
				return res.render("./employee/login", {
					pageTitle: title.employeeLogin,
					email: ""
				})
			}

			req.session.employee = employee

			res.redirect("/employee/dashboard")
		} catch(e) {
			res.status(400).send("Unable to login!\n" + e)
		}
})

router.post("/register", isEmployeeLoggedOut, [
		check("name").not().isEmpty().withMessage("Please provide employee name.").trim().escape(),
		check("email").not().isEmpty().withMessage("Please provide Employee ID").trim().escape(),
		check("password").not().isEmpty().withMessage("Please provide password.").trim().escape(),
		check("confPassword").not().isEmpty().withMessage("Please confirm your password.").custom((value, {req}) => value === req.body.password).withMessage("Password does not match.").trim().escape()
	], async (req, res) => {
		try{
			let name = req.body.name
			let email = req.body.email
			let password = req.body.password

			const errors = validationResult(req)

			if(!errors.isEmpty()) {
				res.render("./employee/register", {
					pageTitle: title.employeeRegister,
					name,
					email,
					errors: errors.array()
				})
			}

			if(!(validator.isEmail(email) || validator.isAlphanumeric(email))) {
				req.flash("danger", "Provide an email or ID")
				return res.redirect("/employee/register")
			}
			
			const employee = await Employee.findOne({ email })

			if(employee){
				req.flash("danger", "Email address exists, use another.")
				return res.render("./employee/register", {
					pageTitle: title.employeeRegister,
					name,
					email: ""
				})
			}
			const newEmployee = await new Employee({
				name,
				email,
				password
			})

			await newEmployee.save()

			delete newEmployee.password
			delete newEmployee.avatar

			req.session.employee = newEmployee

			res.redirect("/employee/dashboard")
		} catch(e) {
			res.status(400).send("Unable to register!\n" + e)
		}
})

router.get("/logout", isEmployeeLoggedIn, (req, res) => {
	req.session.employee = null
	res.redirect("/employee/login")
})

router.get("/dashboard", isEmployeeLoggedIn, async (req, res) => {
	try {
		let monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
		let yearArray = []

		for(let y = moment().year(); y >= 2018; y--)
			yearArray.push(String(y))

		if(["month", "year"].includes(req.query.option)) {

			let viewBy = req.query.option
			let month = Number(req.query.month)
			let year = req.query.year
			let employeeId = req.session.employee._id
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
				return res.redirect("/employee/dashboard")
			}

			const events = await Event.find({ 
				$expr: expression
			}).sort({ date: -1})
			
			res.render("./employee/dashboard", {
				pageTitle: title.employeeDashboard,
				viewBy,
				month,
				monthName: monthArray[month - 1],
				year,
				monthArray,
				yearArray,
				employeeId,
				events
			})			
		} else {
			let month = moment().month() + 1
			let year = moment().year()
			let viewBy = "month"
			let employeeId = req.session.employee._id
			let events = await Event.find({
				$expr: {
					$and: [
						{$eq: [{$year: "$date"}, year]},
						{$eq: [{$month: "$date"}, month]}
					]
				}
			}).sort({ createdAt: 1})

			res.render("./employee/dashboard", {
				pageTitle: title.employeeDashboard,
				viewBy,
				month,
				monthName: monthArray[month - 1],
				year,
				monthArray,
				yearArray,
				employeeId,
				events
			})
		}
	} catch(e) {
		res.status(500).send(`<h3>Something went wrong</h3><p>${e}</p>`)
	}
})

router.get("/profile", isEmployeeLoggedIn, async (req, res) => {
	try {
		const employee = await Employee.findOne({ _id: req.session.employee._id })
		if(!employee) {
			req.flash("danger", "No such employee exists!")
			return res.redirect("/employee/dashboard")
		}
		res.render("./employee/profile", {
			pageTitle: title.employeeProfile,
			name: employee.name,
			email: employee.email,
			avatar: employee.avatar,
			designation: employee.designation,
			department: employee.department
		})
	} catch(e) {
		res.status(500).send({
			error: "Something went wrong!",
			message: e
		})
	}
})

router.post("/profile", isEmployeeLoggedIn, uploadAvatar.single("avatar"), [
		check("name").not().isEmpty().withMessage("Please enter your name!").trim().escape(),
		check("email").isEmpty().withMessage("Email cannot be changed!").trim().escape(),
		check("designation").trim().escape(),
		check("department").trim().escape()
	], async (req, res) => {
		try {
			let name = req.body.name
			let designation = req.body.designation
			let department = req.body.department
			let email = req.session.employee.email
			let buffer

			const errors = validationResult(req)
			if(!errors.isEmpty())
			{
				return res.render("./employee/profile", {
					pageTitle: title.employeeProfile,
					errors: errors.array(),
					avatar: buffer,
					name,
					email,
					designation,
					department
				})
			}

			if(req.file) {
				buffer = await sharp(req.file.buffer).resize({ width: 1024, height: 1024}).png().toBuffer()
			}

			const employee = await Employee.findOne({ _id : req.session.employee._id })

			if(!employee) {
				req.flash("danger", "No such employee exists!")
				return res.redirect("/employee/dashboard")
			}

			employee.name = name
			employee.designation = designation
			employee.department = department
			
			if(buffer) {
				employee.avatar = buffer
			}

			await employee.save()

			delete employee.password
			delete employee.avatar

			req.session.employee = employee

			req.flash("success", "Profile updated successfully!")
			res.redirect("/employee/profile")
		} catch(e) {
			res.status(400).send("Unable to update profile! " + e)
		}
})

router.get("/avatar", isEmployeeLoggedIn, async (req, res) => {
	try {
		const employee = await Employee.findById(req.session.employee._id)
		res.set("Content-Type", "image/png")
		res.send(employee.avatar)
	} catch(e) {
		res.sendStatus(500)
	}
})

router.get("/compare-location", isEmployeeLoggedIn, async (req, res) => {
	try {
		const event = await Event.findById(req.query.eid)

		if(event) {
			const cdate = new Date()
			const rdate = new Date(event.date)

			cdate.setHours(0,0,0,0)
			rdate.setHours(0,0,0,0)

			if(rdate > cdate) {
				req.flash("danger", "Look like event yet to happen!")
				return res.send({
					success: false
				})	
			} else if(rdate < cdate) {
				req.flash("danger", "Look like event already happened!")
				return res.send({
					success: false
				})	
			}

			const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))

			const ctime = {
				h: today.getHours(),
				m: today.getMinutes()
			}

			const stime = event.stime.split(":")
			const etime = event.etime.split(":")

			stime[0] = Number(stime[0])
			stime[1] = Number(stime[1])
			etime[0] = Number(etime[0])
			etime[1] = Number(etime[1])

			if(ctime.h >= stime[0] && ctime.h <= etime[0])
			{
				if(ctime.h == stime[0] && ctime.h == etime[0])
				{
					if(!(ctime.m > stime[1] && ctime.m < etime[1])) {
						req.flash("danger", "Please check the event timing for attendance!")
						return res.send({
							success: false
						})	
					}

				} else if(ctime.h == stime[0]) {
					if(!(ctime.m > stime[1])) {
						req.flash("danger", "Look like you are little early for attendance!")
						return res.send({
							success: false
						})	
					}
				} else if (ctime.h == etime[0]) {
					if(!(ctime.m < etime[1])) {
						req.flash("danger", "Look like you are little late for attendance!")
						return res.send({
							success: false
						})	
					}
				}
			} else if(ctime.h > etime[0]) {
				req.flash("danger", "You are too late for the event!")
				return res.send({
					success: false
				})
			} else if(ctime.h < stime[0]) {
				req.flash("danger", "You are too early for the event!")
				return res.send({
					success: false
				})
			}

			const from = {
				latitude: req.query.latitude,
				longitude: req.query.longitude
			}

			const to = {
				latitude: event.location.latitude,
				longitude: event.location.longitude
			}

			if(geolib.getDistance(from, to) <= 500) {
				event.attendances.push({
					employee: req.session.employee._id,
					date: today
				})

				await event.save()

				req.flash("success", "Attendance made successfully!")
				res.send({
					success: true
				})
			} else {
				req.flash("danger", "Be at the event for attendance!")
				res.send({
					success: false
				})
			}
		} else {
			res.send({
					success: false
			})
		}
	} catch(e) {
		console.log(e)
		res.status(500).send("Unable to compare locations! \n" + e)
	}
})

module.exports = router